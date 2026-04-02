/**
 * DeskPet - 渲染进程主应用
 * Renderer Process Main Application
 */

// 窗口基础大小常量
const BASE_WIDTH = 300;
const BASE_HEIGHT = 400;

class DeskPetApp {
  constructor() {
    this.config = null;
    this.videos = [];
    this.currentVideoIndex = 0;
    this.isPlaying = false;
    this.chromaKey = null;
    this.gsap = null;
    this.elements = {};
  }

  async init() {
    try {
      console.log('=== DeskPet 初始化开始 ===');
      
      // 检查 GSAP 是否加载
      this.gsap = typeof window !== 'undefined' && window.gsap ? window.gsap : null;
      console.log('GSAP 状态:', this.gsap ? '已加载' : '未加载');
      
      this.cacheElements();
      console.log('DOM 元素缓存完成');
      
      // 先设置 ChromaKey，因为 loadConfig 中的 applyConfig 需要用到
      this.setupChromaKey();
      console.log('ChromaKey 设置完成');
      
      await this.loadConfig();
      console.log('配置加载完成');
      await this.loadVideos();
      console.log('视频列表加载完成');
      this.setupEventListeners();
      this.setupIPC();
      this.setupGSAPAnimations();
      
      // 加载第一个视频
      this.log('info', `准备加载视频，视频数量: ${this.videos.length}`);
      if (this.videos.length > 0) {
        this.log('info', '开始播放第一个视频');
        await this.playVideo(0);
      } else {
        this.log('warn', '没有找到视频文件');
      }
      
      this.log('info', 'DeskPet 应用初始化完成');
    } catch (error) {
      this.log('error', '初始化失败', error);
    }
  }

  cacheElements() {
    this.elements = {
      app: document.getElementById('app'),
      videoContainer: document.getElementById('video-container'),
      video: document.getElementById('pet-video'),
      canvas: document.getElementById('chroma-canvas'),
      dragArea: document.getElementById('drag-area'),
      controls: document.getElementById('controls'),
      loading: document.getElementById('loading'),
      btnSwitch: document.getElementById('btn-switch'),
      btnSettings: document.getElementById('btn-settings')
    };
  }

  async loadConfig() {
    try {
      this.config = await window.electronAPI.getConfig();
      this.applyConfig();
      this.log('info', '配置加载成功', this.config);
    } catch (error) {
      this.log('error', '加载配置失败', error);
      throw error;
    }
  }

  async loadVideos() {
    try {
      console.log('开始加载视频列表...');
      this.log('info', '开始加载视频列表...');
      console.log('electronAPI:', window.electronAPI);
      this.videos = await window.electronAPI.getVideos();
      console.log(`找到 ${this.videos.length} 个视频:`, this.videos);
      this.log('info', `找到 ${this.videos.length} 个视频`, this.videos);
    } catch (error) {
      console.error('加载视频列表失败:', error);
      this.log('error', '加载视频列表失败', error);
    }
  }

  applyConfig() {
    const config = this.config;
    
    if (config.window.opacity !== undefined) {
      this.elements.app.style.opacity = config.window.opacity;
    }
    
    if (config.video.chromaKey) {
      this.chromaKey.enabled = config.video.chromaKey.enabled;
    }
    
    if (config.animation?.idleAnimation) {
      this.startIdleAnimation();
    } else {
      this.stopIdleAnimation();
    }
    
    // 应用缩放 - 预览时调整窗口大小
    if (config.window.scale !== undefined) {
      this.applyScale(config.window.scale);
    }
  }

  applyScale(scale) {
    const newWidth = Math.round(BASE_WIDTH * scale);
    const newHeight = Math.round(BASE_HEIGHT * scale);
    console.log('[applyScale] scale:', scale, 'size:', newWidth, 'x', newHeight);
    window.electronAPI.resizeWindow(newWidth, newHeight);
  }

  setupEventListeners() {
    const { video, btnSwitch, btnSettings } = this.elements;

    video.addEventListener('loadeddata', () => {
      this.hideLoading();
      this.isPlaying = true;
      this.startChromaRender();
    });

    video.addEventListener('error', (e) => {
      this.hideLoading();
      this.log('error', '视频加载失败', e);
    });

    video.addEventListener('ended', () => {
      if (this.config.video.loop) {
        video.currentTime = 0;
        video.play();
      }
    });

    btnSwitch.addEventListener('click', (e) => {
      e.stopPropagation();
      this.switchVideo();
    });

    btnSettings.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openSettings();
    });

    let clickTimer = null;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    
    this.elements.app.addEventListener('click', (e) => {
      if (e.target.closest('.controls')) return;
      if (isDragging) return; // 如果正在拖动，不触发点击

      // 如果控制按钮显示，点击其他地方隐藏
      if (!this.elements.controls.classList.contains('hidden')) {
        this.hideControls();
        return;
      }

      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
        this.handleDoubleClick();
      } else {
        clickTimer = setTimeout(() => {
          clickTimer = null;
          this.handleSingleClick();
        }, 250);
      }
    });

    // 右键显示控制按钮
    this.elements.app.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showControls();
    });
    
    // 视频拖动功能
    let windowStartX = 0;
    let windowStartY = 0;
    
    this.elements.videoContainer.addEventListener('mousedown', async (e) => {
      if (e.target.closest('.controls')) return;
      if (this.config.interaction?.dragEnabled === false) return;
      
      isDragging = false;
      dragStartX = e.screenX;
      dragStartY = e.screenY;
      
      // 获取当前窗口位置
      try {
        const pos = await window.electronAPI.getWindowPosition();
        windowStartX = pos.x;
        windowStartY = pos.y;
        console.log('[拖动] 初始窗口位置:', windowStartX, windowStartY);
        console.log('[拖动] 初始鼠标位置:', dragStartX, dragStartY);
      } catch (error) {
        console.error('[拖动] 获取窗口位置失败:', error);
        return;
      }
      
      let lastMoveTime = 0;
      const moveThrottleMs = 16; // 约60fps
      
      const handleMouseMove = (e) => {
        const dx = e.screenX - dragStartX;
        const dy = e.screenY - dragStartY;
        
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          if (!isDragging) {
            console.log('[拖动] 开始拖动，delta:', dx, dy);
            console.log('[拖动] 初始窗口大小:', window.innerWidth, window.innerHeight);
          }
          isDragging = true;
        }
        
        if (isDragging) {
          const now = Date.now();
          if (now - lastMoveTime >= moveThrottleMs) {
            const newX = windowStartX + dx;
            const newY = windowStartY + dy;
            lastMoveTime = now;
            window.electronAPI.moveWindow(newX, newY);
          }
        }
      };
      
      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        console.log('[拖动] 鼠标释放，isDragging:', isDragging);
        console.log('[拖动] 最终窗口大小:', window.innerWidth, window.innerHeight);
        // 通知主进程拖动结束
        window.electronAPI.moveWindowEnd();
        // 延迟重置拖动状态，防止触发点击
        setTimeout(() => { isDragging = false; }, 50);
      };
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    });



    window.addEventListener('resize', () => {
      console.log('[渲染进程] resize 事件触发，窗口大小:', window.innerWidth, window.innerHeight);
      this.resizeCanvas();
    });
  }

  setupIPC() {
    window.electronAPI.onConfigUpdated((config) => {
      this.config = config;
      this.applyConfig();
    });

    window.electronAPI.onOpenSettings(() => {
      this.openSettings();
    });

    window.electronAPI.onSwitchAnimation(() => {
      this.switchVideo();
    });
  }

  setupChromaKey() {
    const canvas = this.elements.canvas;
    const ctx = canvas.getContext('2d', { alpha: true });
    
    this.chromaKey = {
      canvas,
      ctx,
      enabled: true,
      animationId: null
    };
    
    this.resizeCanvas();
  }

  resizeCanvas() {
    const { canvas, videoContainer } = this.elements;
    const rect = videoContainer.getBoundingClientRect();
    
    console.log('[resizeCanvas] 容器大小:', rect.width, rect.height);
    console.log('[resizeCanvas] canvas 原大小:', canvas.width, canvas.height);
    
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    console.log('[resizeCanvas] canvas 新大小:', canvas.width, canvas.height);
  }

  startChromaRender() {
    if (!this.chromaKey || this.chromaKey.animationId) return;
    
    const render = () => {
      this.renderChromaFrame();
      this.chromaKey.animationId = requestAnimationFrame(render);
    };
    
    render();
  }

  stopChromaRender() {
    if (this.chromaKey?.animationId) {
      cancelAnimationFrame(this.chromaKey.animationId);
      this.chromaKey.animationId = null;
    }
  }

  renderChromaFrame() {
    if (!this.chromaKey || !this.elements.video) return;
    
    const { canvas, ctx } = this.chromaKey;
    const video = this.elements.video;
    const config = this.config.video.chromaKey;
    
    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 计算保持原比例的绘制尺寸
    const canvasRatio = canvas.width / canvas.height;
    const videoRatio = video.videoWidth / video.videoHeight;

    // 检查视频尺寸是否有效
    if (!video.videoWidth || !video.videoHeight || !isFinite(videoRatio)) {
      return;
    }

    let drawWidth, drawHeight, offsetX, offsetY;

    if (canvasRatio > videoRatio) {
      // 画布更宽，以高度为基准
      drawHeight = canvas.height;
      drawWidth = drawHeight * videoRatio;
      offsetX = (canvas.width - drawWidth) / 2;
      offsetY = 0;
    } else {
      // 画布更高，以宽度为基准
      drawWidth = canvas.width;
      drawHeight = drawWidth / videoRatio;
      offsetX = 0;
      offsetY = (canvas.height - drawHeight) / 2;
    }
    
    if (!config?.enabled) {
      ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
      return;
    }
    
    // 创建临时 canvas 来处理绿幕
    const tempCanvas = document.createElement('canvas');
    // 确保尺寸为整数且有效
    const tempWidth = Math.max(1, Math.round(drawWidth));
    const tempHeight = Math.max(1, Math.round(drawHeight));
    tempCanvas.width = tempWidth;
    tempCanvas.height = tempHeight;
    const tempCtx = tempCanvas.getContext('2d');
    
    // 在临时 canvas 上绘制视频
    tempCtx.drawImage(video, 0, 0, tempWidth, tempHeight);
    
    // 获取图像数据
    const imageData = tempCtx.getImageData(0, 0, tempWidth, tempHeight);
    const data = imageData.data;
    
    const targetColor = this.hexToRgb(config.color || '#00ff00');
    const similarity = config.similarity || 0.4;
    const smoothness = config.smoothness || 0.1;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      const distance = Math.sqrt(
        Math.pow(r - targetColor.r, 2) +
        Math.pow(g - targetColor.g, 2) +
        Math.pow(b - targetColor.b, 2)
      ) / 441.67;
      
      if (distance < similarity) {
        data[i + 3] = 0;
      } else if (distance < similarity + smoothness) {
        const alpha = (distance - similarity) / smoothness;
        data[i + 3] = Math.round(alpha * 255);
      }
    }
    
    tempCtx.putImageData(imageData, 0, 0);
    
    // 将处理后的图像绘制到主 canvas
    ctx.drawImage(tempCanvas, offsetX, offsetY);
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 255, b: 0 };
  }

  setupGSAPAnimations() {
    if (!this.gsap) {
      this.log('warn', 'GSAP 未加载');
      return;
    }
    
    if (this.config.animation?.idleAnimation) {
      this.startIdleAnimation();
    }
    
    this.log('info', 'GSAP 动画初始化完成');
  }

  startIdleAnimation() {
    if (!this.gsap || !this.config.animation?.idleAnimation) return;
    
    this.gsap.to(this.elements.canvas, {
      scale: 1.02,
      duration: 2,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1
    });
    
    this.gsap.to(this.elements.canvas, {
      y: -5,
      duration: 2.5,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
      delay: 0.5
    });
  }

  stopIdleAnimation() {
    if (!this.gsap) return;
    this.gsap.killTweensOf(this.elements.canvas);
    this.elements.canvas.style.transform = '';
  }

  async playVideo(index) {
    if (this.videos.length === 0) return;
    
    index = index % this.videos.length;
    this.currentVideoIndex = index;
    
    const video = this.videos[index];
    this.showLoading();
    
    try {
      const videoPath = video.path.replace(/\\/g, '/');
      this.elements.video.src = `file:///${videoPath}`;
      this.elements.video.loop = this.config.video.loop;
      await this.elements.video.play();
      this.log('info', '视频加载成功', video.path);
    } catch (error) {
      this.hideLoading();
      this.log('error', '播放视频失败', error);
    }
  }

  pauseVideo() {
    this.elements.video.pause();
    this.isPlaying = false;
    this.updatePlayPauseIcon();
    this.stopChromaRender();
  }

  showControls() {
    this.elements.controls.classList.remove('hidden');
  }

  hideControls() {
    this.elements.controls.classList.add('hidden');
  }

  switchVideo() {
    if (this.videos.length <= 1) return;
    
    const nextIndex = (this.currentVideoIndex + 1) % this.videos.length;
    this.playVideo(nextIndex);
    
    if (this.config.animation?.enabled && this.gsap) {
      this.gsap.fromTo(this.elements.canvas, 
        { opacity: 0, scale: 0.9 },
        { opacity: 1, scale: 1, duration: 0.3, ease: 'power2.out' }
      );
    }
  }

  openSettings() {
    // 通知主进程打开设置窗口
    window.electronAPI.openSettingsWindow && window.electronAPI.openSettingsWindow();
  }

  handleSingleClick() {
    const action = this.config.interaction?.singleClickAction || 'switch';
    
    switch (action) {
      case 'switch':
        this.switchVideo();
        break;
      case 'playpause':
        this.togglePlayPause();
        break;
      default:
        break;
    }
  }

  handleDoubleClick() {
    const action = this.config.interaction?.doubleClickAction || 'settings';
    
    switch (action) {
      case 'settings':
        this.openSettings();
        break;
      case 'switch':
        this.switchVideo();
        break;
      case 'playpause':
        this.togglePlayPause();
        break;
      default:
        break;
    }
  }

  showLoading() {
    this.elements.loading.classList.remove('hidden');
  }

  hideLoading() {
    this.elements.loading.classList.add('hidden');
  }

  log(level, message, data) {
    console.log(`[${level.toUpperCase()}] ${message}`, data || '');
    
    if (window.electronAPI?.log) {
      window.electronAPI.log(level, message, data);
    }
  }
}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM 加载完成，启动 DeskPet');
  const app = new DeskPetApp();
  app.init();
});
