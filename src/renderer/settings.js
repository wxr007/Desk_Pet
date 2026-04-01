// 设置窗口脚本
class SettingsApp {
  constructor() {
    this.config = null;
    this.videos = [];
    this.elements = {};
    this.init();
  }

  async init() {
    this.cacheElements();
    this.setupEventListeners();
    await this.loadConfig();
    await this.loadVideos();
  }

  cacheElements() {
    this.elements = {
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
      heightValue: document.getElementById('height-value'),
      btnSelectFolder: document.getElementById('btn-select-folder'),
      btnSave: document.getElementById('btn-save'),
      btnReset: document.getElementById('btn-reset'),
      btnClose: document.getElementById('btn-close'),

    };
  }

  setupEventListeners() {
    const { chromaEnabled, chromaColor, chromaSimilarity, chromaSmoothness, windowOpacity, windowWidth, windowHeight, windowAlwaysTop, windowClickThrough } = this.elements;

    this.elements.btnSelectFolder.addEventListener('click', () => this.selectVideoFolder());
    this.elements.btnSave.addEventListener('click', () => this.saveSettings());
    this.elements.btnReset.addEventListener('click', () => this.resetSettings());
    this.elements.btnClose.addEventListener('click', () => this.closeSettings());



    // 窗口关闭前恢复原始配置
    window.addEventListener('beforeunload', () => {
      this.restoreOriginalConfig();
    });

    // 绿幕设置实时预览
    chromaEnabled.addEventListener('change', () => this.previewSettings());
    chromaColor.addEventListener('input', () => this.previewSettings());
    chromaSimilarity.addEventListener('input', () => { this.updateValueDisplays(); this.previewSettings(); });
    chromaSmoothness.addEventListener('input', () => { this.updateValueDisplays(); this.previewSettings(); });
    
    // 窗口设置实时预览
    windowOpacity.addEventListener('input', () => { this.updateValueDisplays(); this.previewSettings(); });
    windowWidth.addEventListener('input', () => { this.updateValueDisplays(); this.previewSettings(); });
    windowHeight.addEventListener('input', () => { this.updateValueDisplays(); this.previewSettings(); });
    windowAlwaysTop.addEventListener('change', () => this.previewSettings());
    windowClickThrough.addEventListener('change', () => this.previewSettings());
  }

  async loadConfig() {
    try {
      this.config = await window.electronAPI.getConfig();
      this.updateSettingsUI();
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  }

  async loadVideos() {
    try {
      this.videos = await window.electronAPI.getVideos();
      this.updateVideoSelect();
    } catch (error) {
      console.error('加载视频列表失败:', error);
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

  updateVideoSelect() {
    const select = this.elements.videoSelect;
    select.innerHTML = '';
    
    this.videos.forEach((video, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = video.name;
      select.appendChild(option);
    });
  }

  async selectVideoFolder() {
    try {
      const result = await window.electronAPI.selectVideoFolder();
      if (result.success) {
        this.elements.videoFolder.value = result.path;
        this.videos = await window.electronAPI.getVideos();
        this.updateVideoSelect();
      }
    } catch (error) {
      console.error('选择视频目录失败:', error);
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
        console.log('配置保存成功');
        window.close();
      } else {
        console.error('保存配置失败:', result.error);
      }
    } catch (error) {
      console.error('保存配置失败:', error);
    }
  }

  async previewSettings() {
    const previewConfig = {
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
        alwaysOnTop: this.elements.windowAlwaysTop.checked,
        clickThrough: this.elements.windowClickThrough.checked
        // 不传递 width 和 height，避免改变窗口大小
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
      await window.electronAPI.previewConfig(previewConfig);
    } catch (error) {
      console.error('预览配置失败:', error);
    }
  }

  closeSettings() {
    // 恢复原始配置后关闭
    this.restoreOriginalConfig();
    window.close();
  }

  async openEyeDropper() {
    try {
      const eyeDropper = new EyeDropper();
      const result = await eyeDropper.open();
      if (result && result.sRGBHex) {
        this.elements.chromaColor.value = result.sRGBHex;
        this.previewSettings();
      }
    } catch (error) {
      console.log('取色取消或失败:', error);
    }
  }

  restoreOriginalConfig() {
    // 恢复加载时的原始配置
    if (this.config) {
      window.electronAPI.previewConfig(this.config);
    }
  }

  resetSettings() {
    const defaultConfig = {
      video: {
        loop: true,
        chromaKey: {
          enabled: true,
          color: '#00ff00',
          similarity: 0.4,
          smoothness: 0.1
        }
      },
      window: {
        opacity: 1,
        width: 300,
        height: 400,
        alwaysOnTop: true,
        clickThrough: false
      },
      interaction: {
        singleClickAction: 'switch',
        doubleClickAction: 'settings'
      },
      animation: {
        enabled: true,
        idleAnimation: true
      }
    };

    this.elements.videoLoop.checked = defaultConfig.video.loop;
    this.elements.chromaEnabled.checked = defaultConfig.video.chromaKey.enabled;
    this.elements.chromaColor.value = defaultConfig.video.chromaKey.color;
    this.elements.chromaSimilarity.value = defaultConfig.video.chromaKey.similarity;
    this.elements.chromaSmoothness.value = defaultConfig.video.chromaKey.smoothness;
    this.elements.windowOpacity.value = defaultConfig.window.opacity;
    this.elements.windowWidth.value = defaultConfig.window.width;
    this.elements.windowHeight.value = defaultConfig.window.height;
    this.elements.windowAlwaysTop.checked = defaultConfig.window.alwaysOnTop;
    this.elements.windowClickThrough.checked = defaultConfig.window.clickThrough;
    this.elements.clickAction.value = defaultConfig.interaction.singleClickAction;
    this.elements.dblclickAction.value = defaultConfig.interaction.doubleClickAction;
    this.elements.animationEnabled.checked = defaultConfig.animation.enabled;
    this.elements.idleAnimation.checked = defaultConfig.animation.idleAnimation;

    this.updateValueDisplays();
    
    // 重置后触发预览
    this.previewSettings();
  }
}

// 启动设置应用
document.addEventListener('DOMContentLoaded', () => {
  new SettingsApp();
});
