/**
 * DeskPet - 配置管理器
 * Configuration Manager
 */

const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');
const log = require('electron-log');

class ConfigManager {
  constructor() {
    this.configPath = path.join(app.getAppPath(), 'config', 'settings.json');
    this.defaultConfig = {
      window: {
        width: 300,
        height: 400,
        x: null,
        y: null,
        opacity: 1.0,
        scale: 1.0,
        alwaysOnTop: true,
        clickThrough: false
      },
      video: {
        folder: path.join(app.getAppPath(), 'src', 'assets', 'videos'),
        currentVideo: null,
        loop: true,
        volume: 0,
        playbackRate: 1.0,
        chromaKey: {
          enabled: true,
          color: '#00ff00',
          similarity: 0.4,
          smoothness: 0.1
        }
      },
      animation: {
        enabled: true,
        idleAnimation: true,
        idleInterval: 30,
        gsapEffects: {
          bounce: true,
          shake: true,
          pulse: true
        }
      },
      interaction: {
        singleClickAction: 'switch',
        doubleClickAction: 'settings',
        dragEnabled: true
      },
      advanced: {
        hardwareAcceleration: true,
        frameSkip: 0,
        maxFps: 60
      },
      settingsWindow: {
        x: null,
        y: null
      }
    };
    this.config = null;
  }

  async load() {
    try {
      // 确保配置目录存在
      const configDir = path.dirname(this.configPath);
      await fs.mkdir(configDir, { recursive: true });
      
      // 尝试读取配置文件
      try {
        const data = await fs.readFile(this.configPath, 'utf8');
        const loadedConfig = JSON.parse(data);
        this.config = this.mergeDeep(this.defaultConfig, loadedConfig);
        log.info('配置加载成功');
      } catch (error) {
        // 配置文件不存在或损坏，使用默认配置
        this.config = JSON.parse(JSON.stringify(this.defaultConfig));
        await this.save();
        log.info('使用默认配置');
      }
    } catch (error) {
      log.error('加载配置失败:', error);
      this.config = JSON.parse(JSON.stringify(this.defaultConfig));
    }
  }

  async save() {
    try {
      const configDir = path.dirname(this.configPath);
      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
      log.debug('配置保存成功');
    } catch (error) {
      log.error('保存配置失败:', error);
      throw error;
    }
  }

  async update(newConfig) {
    this.config = this.mergeDeep(this.config, newConfig);
    await this.save();
  }

  get(key) {
    if (!key) return this.config;
    return this.getNestedValue(this.config, key);
  }

  set(key, value) {
    this.setNestedValue(this.config, key, value);
  }

  getNestedValue(obj, path) {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[key];
    }
    
    return current;
  }

  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  mergeDeep(target, source) {
    const output = Object.assign({}, target);
    
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.mergeDeep(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    
    return output;
  }

  isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  reset() {
    this.config = JSON.parse(JSON.stringify(this.defaultConfig));
    return this.save();
  }
}

module.exports = ConfigManager;
