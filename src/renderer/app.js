/**
 * DeskPet - 渲染进程主应用
 * Renderer Process Main Application
 */

class DeskPetApp {
  constructor() {
    this.config = null;
    this.videos = [];
    this.currentVideoIndex = 0;
    this.isPlaying = false;
    this.isSettingsOpen = false;
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
      await this.loadConfig();
      console.log('配置加载完成');
      await this.loadVideos();
      console.log('视频列表加载完成');
      this.setupEventListeners();
      this.setupIPC();
      this.setupChromaKey();
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
      settingsPanel: document.getElementById('settings-panel'),
      btnPlayPause: document.getElementById('btn-play-pause'),
      btnSwitch: document.getElementById('btn-switch'),
      btnSettings: document.getElementById('btn-settings'),
      btnCloseSettings: document.getElementById('btn-close-settings'),
      btnSelectFolder: document.getElementById('btn-select-folder'),
      btnSave: document.getElementById('btn-save'),
      btnReset: document.getElementById('btn-reset'),
      videoFolder: document.getElementById('video-folder'),
      videoSelect: document.getElementById('video-select'),
      videoLoop: document.getElementById('video-loop'),
      chromaEnabled: document.getElementById('chroma-enabled'),
      chromaColor: document.getElementById('chroma-color'),
      chromaSimilarity: document.getElementById('chroma-similarity'),
      chromaSmoothness: document.getElementById('chroma-smoothness'),
      windowOpacity: document.getElementById('window-opacity'),
      windowWidth: document.getElementById('window-width'),
      windowHeight: document.getElementById('window-height'),
      windowAlwaysTop: document.getElementById('window-always-top'),
      windowClickThrough: document.getElementById('window-click-through'),
      clickAction: document.getElementById('click-action'),
      dblclickAction: document.getElementById('dblclick-action'),
      animationEnabled: document.getElementById('animation-enabled'),
      idleAnimation: document.getElementById('idle-animation'),
      similarityValue: document.getElementById('similarity-value'),
      smoothnessValue: document.getElementById('smoothness-value'),
      opacityValue: document.getElementById('opacity-value'),
      widthValue: document.getElementById('width-value'),
      heightValue: document.getElementById('height-value')
    };
  }

  async loadConfig() {
    try {
      this.config = await window.electronAPI.getConfig();
      this.updateSettingsUI();
      this.log('info', '配置加载成功', this.config);
    } catch (error) {
      this.log('error', '加载配置失败', error);
      throw error;
    }
  }

  updateSettingsUI() {
    const cfg = this.config;
    this.elements.videoFolder.value = cfg.video.folder || '';
    this.elements.videoLoop.checked = cfg.video.loop !== false;
    this.elements.chromaEnabled.checked = cfg.video.chromaKey?.enabled !== false;
    this.elements.chromaColor.value = cfg.video.chromaKey?.color || '#00ff00';
    this.elements.chromaSimilarity.value = cfg.video.chromaKey?.similarity || 0.4;
    this.elements.chromaSmoothness.value = cfg.video.chromaKey?.smoothness || 0.1;
    this.elements.windowOpacity.value = cfg.window.opacity || 1;
    this.elements.windowWidth.value = cfg.window.width || 300;
    this.elements.windowHeight.value = cfg.window.height || 400;
    this.elements.windowAlwaysTop.checked = cfg.window.alwaysOnTop !== false;
    this.elements.windowClickThrough.checked = cfg.window.clickThrough || false;
    this.elements.clickAction.value = cfg.interaction?.singleClickAction || 'switch';
    this.elements.dblclickAction.value = cfg.interaction?.doubleClickAction || 'settings';
    this.elements.animationEnabled.checked = cfg.animation?.enabled !== false;
    this.elements.idleAnimation.checked = cfg.animation?.idleAnimation !== false;
    this.updateValueDisplays();
  }

  updateValueDisplays() {
    this.elements.similarityValue.textContent = this.elements.chromaSimilarity.value;
    this.elements.smoothnessValue.textContent = this.elements.chromaSmoothness.value;
    this.elements.opacityValue.textContent = Math.round(this.elements.windowOpacity.value * 100) + '%';
    this.elements.widthValue.textContent = this.elements.windowWidth.value + 'px';
    this.elements.heightValue.textContent = this.elements.windowHeight.value + 'px';
  }

  setupEventListeners() {
    const { video, btnPlayPause, btnSwitch, btnSettings, btnCloseSettings, btnSelectFolder, btnSave, btnReset, chromaSimilarity, chromaSmoothness, windowOpacity, windowWidth, windowHeight } = this.elements;

    video.addEventListener('loadeddata', () => {
      this.hideLoading();
      this.isPlaying = true;
      this.updatePlayPauseIcon();
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

    btnPlayPause.addEventListener('click', (e) => {
      e.stopPropagation();
      this.togglePlayPause();
    });

    btnSwitch.addEventListener('click', (e) => {
      e.stopPropagation();
      this.switchVideo();
    });

    btnSettings.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openSettings();
    });

    btnCloseSettings.addEventListener('click', () => this.closeSettings());
    btnSave.addEventListener('click', () => this.saveSettings());
    btnReset.addEventListener('click', () => this.resetSettings());
    btnSelectFolder.addEventListener('click', () => this.selectVideoFolder());

    chromaSimilarity.addEventListener('input', () => this.updateValueDisplays());
    chromaSmoothness.addEventListener('input', () => this.updateValueDisplays());
    windowOpacity.addEventListener('input', () => this.updateValueDisplays());
    windowWidth.addEventListener('input', () => this.updateValueDisplays());
    windowHeight.addEventListener('input', () => this.updateValueDisplays());

    let clickTimer = null;
    this.elements.app.addEventListener('click', (e) => {
      if (e.target.closest('.controls') || e.target.closest('.settings-panel')) return;
      
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

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isSettingsOpen) {
        this.closeSettings();
      }
      if (e.key === ' ') {
        e.preventDefault();
        this.togglePlayPause();
      }
    });

    window.addEventListener('resize', () => {
      this.resizeCanvas();
    });
  }

  setupIPC() {
    window.electronAPI.onConfigUpdated((config) => {
      this.config = config;
      this.updateSettingsUI();
      this.applyConfig();
    });

    window.electronAPI.onOpenSettings(() => {
      this.openSettings();
    });

    window.electronAPI.onTogglePlayPause(() => {
      this.togglePlayPause();
    });

    window.electronAPI.onSwitchAnimation(() => {
      this.switchVideo();
    });
  }

  async loadVideos() {
    try {
      console.log('开始加载视频列表...');
      this.log('info', '开始加载视频列表...');
      console.log('electronAPI:', window.electronAPI);
      this.videos = await window.electronAPI.getVideos();
      console.log(`找到 ${this.videos.length} 个视频:`, this.videos);
      this.log('info', `找到 ${this.videos.length} 个视频`, this.videos);
      this.updateVideoSelect();
    } catch (error) {
      console.error('加载视频列表失败:', error);
      this.log('error', '加载视频列表失败', error);
    }
  }

  updateVideoSelect() {
    const select = this.elements.videoSelect;
    select.innerHTML = '';
    
    this.videos.forEach((video, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = video.name;
      select.appendChild(option);
    });
    
    select.value = this.currentVideoIndex;
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
      this.elements.videoSelect.value = index;
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

  togglePlayPause() {
    if (this.isPlaying) {
      this.pauseVideo();
    } else {
      this.elements.video.play();
      this.isPlaying = true;
      this.updatePlayPauseIcon();
      this.startChromaRender();
    }
  }

  switchVideo() {
    const nextIndex = (this.currentVideoIndex + 1) % this.videos.length;
    this.playVideo(nextIndex);
    
    if (this.config.animation?.enabled && this.gsap) {
      this.gsap.fromTo(this.elements.canvas, 
        { opacity: 0, scale: 0.9 },
        { opacity: 1, scale: 1, duration: 0.3, ease: 'power2.out' }
      );
    }
  }

  updatePlayPauseIcon() {
    const icon = this.elements.btnPlayPause.querySelector('.icon');
    icon.textContent = this.isPlaying ? '⏸' : '▶';
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
    
    canvas.width = rect.width;
    canvas.height = rect.height;
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
    
    if (!config?.enabled) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return;
    }
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
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
    
    ctx.putImageData(imageData, 0, 0);
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
      duration: 3,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
      delay: 0.5
    });
  }

  stopIdleAnimation() {
    if (!this.gsap) return;
    this.gsap.killTweensOf(this.elements.canvas);
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
      case 'settings':
        this.openSettings();
        break;
      case 'none':
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
      case 'none':
      default:
        break;
    }
  }

  openSettings() {
    this.elements.settingsPanel.classList.remove('hidden');
    this.isSettingsOpen = true;
    this.stopIdleAnimation();
  }

  closeSettings() {
    this.elements.settingsPanel.classList.add('hidden');
    this.isSettingsOpen = false;
    
    if (this.config.animation?.idleAnimation) {
      this.startIdleAnimation();
    }
  }

  async saveSettings() {
    const newConfig = {
      video: {
        folder: this.elements.videoFolder.value,
        loop: this.elements.videoLoop.checked,
        chromaKey: {
          enabled: this.elements.chromaEnabled.checked,
          color: this.elements.chromaColor.value,
          similarity: parseFloat(this.elements.chromaSimilarity.value),
          smoothness: parseFloat(this.elements.chromaSmoothness.value)
        }
      },
      window: {
        opacity: parseFloat(this.elements.windowOpacity.value),
        width: parseInt(this.elements.windowWidth.value),
        height: parseInt(this.elements.windowHeight.value),
        alwaysOnTop: this.elements.windowAlwaysTop.checked,
        clickThrough: this.elements.windowClickThrough.checked
      },
      interaction: {
        singleClickAction: this.elements.clickAction.value,
        doubleClickAction: this.elements.dblclickAction.value
      },
      animation: {
        enabled: this.elements.animationEnabled.checked,
        idleAnimation: this.elements.idleAnimation.checked
      }
    };

    try {
      const result = await window.electronAPI.saveConfig(newConfig);
      if (result.success) {
        this.config = { ...this.config, ...newConfig };
        this.applyConfig();
        this.closeSettings();
        this.log('info', '配置保存成功');
      } else {
        this.log('error', '保存配置失败', result.error);
      }
    } catch (error) {
      this.log('error', '保存配置失败', error);
    }
  }

  resetSettings() {
    this.updateSettingsUI();
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
  }

  async selectVideoFolder() {
    try {
      const result = await window.electronAPI.selectVideoFolder();
      if (result.success) {
        this.elements.videoFolder.value = result.path;
        await this.loadVideos();
      }
    } catch (error) {
      this.log('error', '选择视频目录失败', error);
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
