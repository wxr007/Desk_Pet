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

    // 动画状态管理
    this.petState = 'idle'; // 'idle' | 'walking'
    this.petDirection = 'none'; // 'left' | 'right' | 'none'
    this.videoCategories = {
      sit: [],    // 坐着动画
      walkLeft: [],  // 向左走
      walkRight: []  // 向右走
    };
    this.stateTimer = null;
    this.isMoving = false;
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
      this.setupEventListeners();
      this.setupIPC();
      this.setupGSAPAnimations();
      console.log('事件监听设置完成');
      await this.loadVideos();
      console.log('视频列表加载完成');

      // 初始化时根据当前状态播放动画（在 loadVideos 中已完成）
      // 不需要再播放第一个视频，因为 initializePetState 已经处理了

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

      // 分类视频
      this.categorizeVideos();

      // 初始化时根据当前状态播放动画
      await this.initializePetState();

      // 启动宠物自动行为
      this.startPetBehavior();
    } catch (error) {
      console.error('加载视频列表失败:', error);
      this.log('error', '加载视频列表失败', error);
    }
  }

  // 根据文件名分类视频
  categorizeVideos() {
    this.videoCategories = {
      sit: [],
      walkLeft: [],
      walkRight: []
    };

    for (let i = 0; i < this.videos.length; i++) {
      const video = this.videos[i];
      const name = video.name.toLowerCase();

      if (name.includes('-坐')) {
        this.videoCategories.sit.push(i);
      } else if (name.includes('-走')) {
        if (name.includes('-左')) {
          this.videoCategories.walkLeft.push(i);
        } else {
          // 没有方向的走路动画，默认当作向右
          this.videoCategories.walkRight.push(i);
        }
      }
    }

    console.log('视频分类:', this.videoCategories);
    this.log('info', '视频分类完成', this.videoCategories);
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
      console.log('[video] loadeddata 事件触发');
      this.hideLoading();
      this.isPlaying = true;
      this.startChromaRender();
    });

    video.addEventListener('error', (e) => {
      this.hideLoading();
      const error = e.target.error;
      let errorMsg = '未知错误';
      if (error) {
        switch (error.code) {
          case 1: errorMsg = 'MEDIA_ERR_ABORTED - 用户中止'; break;
          case 2: errorMsg = 'MEDIA_ERR_NETWORK - 网络错误'; break;
          case 3: errorMsg = 'MEDIA_ERR_DECODE - 解码错误'; break;
          case 4: errorMsg = 'MEDIA_ERR_SRC_NOT_SUPPORTED - 格式不支持'; break;
        }
      }
      this.log('error', '视频加载失败: ' + errorMsg, { code: error?.code, message: error?.message });
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
    if (!this.chromaKey) {
      console.log('[startChromaRender] 跳过: chromaKey 未初始化');
      return;
    }
    if (this.chromaKey.animationId) {
      console.log('[startChromaRender] 跳过: 已经在渲染中');
      return;
    }
    
    console.log('[startChromaRender] 开始绿幕渲染');
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
    if (!this.chromaKey || !this.elements.video) {
      console.log('[renderChromaFrame] 跳过: chromaKey=', !!this.chromaKey, ', video=', !!this.elements.video);
      return;
    }
    
    const { canvas, ctx } = this.chromaKey;
    const video = this.elements.video;
    const config = this.config?.video?.chromaKey;
    
    // 检查视频是否准备好
    if (video.readyState < 2) {
      console.log('[renderChromaFrame] 视频未准备好, readyState:', video.readyState);
      return;
    }
    
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

  // 开始宠物自动行为循环
  startPetBehavior() {
    console.log('[startPetBehavior] 启动宠物行为');
    if (this.stateTimer) {
      console.log('[startPetBehavior] 清除之前的定时器');
      clearTimeout(this.stateTimer);
    }
    this.scheduleNextBehavior();
  }

  // 停止宠物行为
  stopPetBehavior() {
    if (this.stateTimer) {
      clearTimeout(this.stateTimer);
      this.stateTimer = null;
    }
    this.stopMoving();
  }

  // 安排下一个行为
  scheduleNextBehavior() {
    console.log('[scheduleNextBehavior] 当前状态:', this.petState);
    if (this.petState === 'idle') {
      // 坐着状态，3-6秒后起来走走
      const delay = 3000 + Math.random() * 3000;
      console.log('[scheduleNextBehavior] 坐着状态，', delay, 'ms后走路');
      this.stateTimer = setTimeout(() => {
        console.log('[scheduleNextBehavior] 定时器触发，开始走路');
        this.startWalking();
      }, delay);
    } else {
      // 走路状态，3-5秒后坐下
      const delay = 3000 + Math.random() * 2000;
      console.log('[scheduleNextBehavior] 走路状态，', delay, 'ms后坐下');
      this.stateTimer = setTimeout(() => {
        console.log('[scheduleNextBehavior] 定时器触发，开始坐着');
        this.startSitting();
      }, delay);
    }
  }

  // 初始化宠物状态
  async initializePetState() {
    console.log('[初始化] 初始化宠物状态');
    // 默认从坐着开始
    this.petState = 'idle';
    this.petDirection = 'none';

    // 清除镜像翻转
    this.elements.video.style.transform = '';
    this.elements.canvas.style.transform = '';

    // 播放坐着动画
    if (this.videoCategories.sit.length > 0) {
      const randomIndex = Math.floor(Math.random() * this.videoCategories.sit.length);
      const videoIndex = this.videoCategories.sit[randomIndex];
      await this.playVideo(videoIndex);
      console.log('[初始化] 播放坐着动画');
    } else if (this.videos.length > 0) {
      // 如果没有坐着动画，播放第一个视频
      await this.playVideo(0);
      console.log('[初始化] 没有坐着动画，播放第一个视频');
    }
  }

  // 开始坐着
  startSitting() {
    this.petState = 'idle';
    this.petDirection = 'none';
    this.stopMoving();

    // 清除镜像翻转
    this.elements.video.style.transform = '';
    this.elements.canvas.style.transform = '';

    // 随机选择一个坐着动画
    if (this.videoCategories.sit.length > 0) {
      const randomIndex = Math.floor(Math.random() * this.videoCategories.sit.length);
      const videoIndex = this.videoCategories.sit[randomIndex];
      this.playVideo(videoIndex);
    }

    this.scheduleNextBehavior();
  }

  // 开始走路
  async startWalking() {
    // 随机选择方向
    const hasLeft = this.videoCategories.walkLeft.length > 0;
    const hasRight = this.videoCategories.walkRight.length > 0;

    if (!hasLeft && !hasRight) {
      // 没有走路动画，继续坐着
      this.scheduleNextBehavior();
      return;
    }

    // 获取当前位置和屏幕尺寸
    let currentX = 0;
    try {
      const pos = await window.electronAPI.getWindowPosition();
      currentX = pos.x;
    } catch (error) {
      console.error('获取位置失败:', error);
    }

    // 先设置默认方向，避免状态不一致
    this.petDirection = hasRight ? 'right' : 'left';
    this.petState = 'walking';

    const screenWidth = window.screen.width;
    const windowWidth = window.innerWidth;
    const margin = 100; // 边界安全距离

    // 根据位置智能选择方向
    const tooCloseLeft = currentX < margin;
    const tooCloseRight = currentX + windowWidth > screenWidth - margin;

    if (tooCloseLeft && tooCloseRight) {
      // 屏幕太小，随机选择
      this.petDirection = Math.random() < 0.5 ? 'left' : 'right';
      console.log('[宠物移动] 屏幕太小，随机方向:', this.petDirection);
    } else if (tooCloseLeft) {
      // 太靠近左边，向右移动
      this.petDirection = 'right';
      console.log('[宠物移动] 太靠近左边，选择向右移动');
    } else if (tooCloseRight) {
      // 太靠近右边，向左移动
      this.petDirection = 'left';
      console.log('[宠物移动] 太靠近右边，选择向左移动');
    } else {
      // 在安全区域，随机选择
      if (hasLeft && hasRight) {
        this.petDirection = Math.random() < 0.5 ? 'left' : 'right';
      } else if (hasLeft) {
        this.petDirection = 'left';
      } else {
        this.petDirection = 'right';
      }
      console.log('[宠物移动] 在安全区域，随机方向:', this.petDirection);
    }

    // 播放对应动画
    console.log('[startWalking] 准备播放动画，方向:', this.petDirection);
    this.playDirectionAnimation();

    // 开始移动
    console.log('[startWalking] 准备开始移动');
    this.startMoving();
    this.scheduleNextBehavior();
  }

  // 播放对应方向的动画
  playDirectionAnimation() {
    console.log('[playDirectionAnimation] 方向:', this.petDirection, '左动画数:', this.videoCategories.walkLeft.length, '右动画数:', this.videoCategories.walkRight.length);
    if (this.petDirection === 'left') {
      if (this.videoCategories.walkLeft.length > 0) {
        console.log('[playDirectionAnimation] 使用左走动画');
        const randomIndex = Math.floor(Math.random() * this.videoCategories.walkLeft.length);
        const videoIndex = this.videoCategories.walkLeft[randomIndex];
        this.playVideo(videoIndex);
        this.elements.video.style.transform = '';
        this.elements.canvas.style.transform = '';
      } 
      // else if (this.videoCategories.walkRight.length > 0) {
      //   // 没有左走动画，使用右走并镜像翻转
      //   console.log('[playDirectionAnimation] 没有左走动画，使用右走并镜像');
      //   const randomIndex = Math.floor(Math.random() * this.videoCategories.walkRight.length);
      //   const videoIndex = this.videoCategories.walkRight[randomIndex];
      //   this.playVideo(videoIndex);
      //   this.elements.video.style.transform = 'scaleX(-1)';
      //   this.elements.canvas.style.transform = 'scaleX(-1)';
      // }
    } else {
      if (this.videoCategories.walkRight.length > 0) {
        console.log('[playDirectionAnimation] 使用右走动画');
        const randomIndex = Math.floor(Math.random() * this.videoCategories.walkRight.length);
        const videoIndex = this.videoCategories.walkRight[randomIndex];
        this.playVideo(videoIndex);
        this.elements.video.style.transform = '';
        this.elements.canvas.style.transform = '';
      }
      // else if (this.videoCategories.walkLeft.length > 0) {
      //   // 没有右走动画，使用左走并镜像翻转
      //   console.log('[playDirectionAnimation] 没有右走动画，使用左走并镜像');
      //   const randomIndex = Math.floor(Math.random() * this.videoCategories.walkLeft.length);
      //   const videoIndex = this.videoCategories.walkLeft[randomIndex];
      //   this.playVideo(videoIndex);
      //   this.elements.video.style.transform = 'scaleX(-1)';
      //   this.elements.canvas.style.transform = 'scaleX(-1)';
      // }
    }
  }

  // 开始移动窗口
  startMoving() {
    if (this.isMoving) {
      console.log('[移动] 已经在移动中，跳过');
      return;
    }
    this.isMoving = true;
    console.log('[移动] 开始移动，方向:', this.petDirection);
    this.moveStep();
  }

  // 停止移动
  stopMoving() {
    this.isMoving = false;
  }

  // 移动步进
  async moveStep() {
    if (!this.isMoving || this.petState !== 'walking') {
      console.log('[移动] 停止移动，isMoving:', this.isMoving, 'petState:', this.petState);
      return;
    }

    try {
      const pos = await window.electronAPI.getWindowPosition();
      const speed = 2; // 降低移动速度（像素/帧）
      console.log('[移动] 当前位置:', pos.x, ', 方向:', this.petDirection);

      // 获取屏幕尺寸
      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;
      // 获取窗口尺寸
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;

      let newX = pos.x;
      if (this.petDirection === 'left') {
        newX -= speed;
        // 防止走出左边界
        if (newX < 0) {
          newX = 0;
          // 碰到边界就转身
          this.turnAround();
          return;
        }
      } else if (this.petDirection === 'right') {
        newX += speed;
        // 防止走出右边界
        if (newX + windowWidth > screenWidth) {
          newX = screenWidth - windowWidth;
          console.log('[移动] 到达右边界，调整位置:', newX);
          // 碰到边界就转身
          this.turnAround();
          return;
        }
      } else {
        console.log('[移动] 未知方向:', this.petDirection, '不移动');
        // 继续下一步
        if (this.isMoving) {
          requestAnimationFrame(() => this.moveStep());
        }
        return;
      }

      // 使用 moveWindow 移动
      // console.log('[移动] 移动到:', newX, pos.y);
      window.electronAPI.moveWindow(newX, pos.y);
      const new_pos = await window.electronAPI.getWindowPosition();
      // console.log('[移动] 移动到:', new_pos.x, new_pos.y,"窗口大小:",windowWidth,windowHeight);
    } catch (error) {
      console.error('移动失败:', error);
    }

    // 继续下一步
    if (this.isMoving) {
      requestAnimationFrame(() => this.moveStep());
    }
  }

  // 转身（改变方向）
  turnAround() {
    console.log('[转身] 当前方向:', this.petDirection);
    // 停止当前移动
    this.stopMoving();

    // 切换方向
    if (this.petDirection === 'left') {
      this.petDirection = 'right';
    } else {
      this.petDirection = 'left';
    }
    console.log('[转身] 新方向:', this.petDirection);

    // 重新选择对应方向的动画
    this.playDirectionAnimation();

    // 继续移动
    this.startMoving();
  }

  // 播放对应方向的动画
  playDirectionAnimation() {
    if (this.petDirection === 'left') {
      if (this.videoCategories.walkLeft.length > 0) {
        const randomIndex = Math.floor(Math.random() * this.videoCategories.walkLeft.length);
        const videoIndex = this.videoCategories.walkLeft[randomIndex];
        this.playVideo(videoIndex);
        this.elements.video.style.transform = '';
        this.elements.canvas.style.transform = '';
      } else if (this.videoCategories.walkRight.length > 0) {
        // 没有左走动画，使用右走并镜像翻转
        const randomIndex = Math.floor(Math.random() * this.videoCategories.walkRight.length);
        const videoIndex = this.videoCategories.walkRight[randomIndex];
        this.playVideo(videoIndex);
        this.elements.video.style.transform = 'scaleX(-1)';
        this.elements.canvas.style.transform = 'scaleX(-1)';
      }
    } else {
      if (this.videoCategories.walkRight.length > 0) {
        const randomIndex = Math.floor(Math.random() * this.videoCategories.walkRight.length);
        const videoIndex = this.videoCategories.walkRight[randomIndex];
        this.playVideo(videoIndex);
        this.elements.video.style.transform = '';
        this.elements.canvas.style.transform = '';
      } else if (this.videoCategories.walkLeft.length > 0) {
        // 没有右走动画，使用左走并镜像翻转
        const randomIndex = Math.floor(Math.random() * this.videoCategories.walkLeft.length);
        const videoIndex = this.videoCategories.walkLeft[randomIndex];
        this.playVideo(videoIndex);
        this.elements.video.style.transform = 'scaleX(-1)';
        this.elements.canvas.style.transform = 'scaleX(-1)';
      }
    }
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
      this.log('error', '播放视频失败: ' + (error.message || error), { name: error.name, message: error.message });
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
