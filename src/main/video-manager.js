/**
 * DeskPet - 视频管理器
 * Video Manager
 */

const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');
const log = require('electron-log');

class VideoManager {
  constructor() {
    this.supportedFormats = ['.mp4', '.webm', '.mov', '.mkv', '.avi'];
    this.videoCache = new Map();
  }

  async getVideoList(folderPath) {
    try {
      // 如果未指定路径，使用默认路径
      if (!folderPath) {
        // 开发模式：使用项目根目录
        // 生产模式：使用 extraResource 目录
        const isDev = !app.isPackaged;
        if (isDev) {
          folderPath = path.join(process.cwd(), 'src', 'assets', 'videos');
        } else {
          folderPath = path.join(process.resourcesPath, 'videos');
        }
      }

      // 检查目录是否存在
      try {
        await fs.access(folderPath);
      } catch {
        log.warn('视频目录不存在:', folderPath);
        return [];
      }

      const files = await fs.readdir(folderPath);
      const videos = [];

      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (this.supportedFormats.includes(ext)) {
          const filePath = path.join(folderPath, file);
          try {
            const stats = await fs.stat(filePath);
            videos.push({
              name: path.basename(file, ext),
              filename: file,
              path: filePath,
              size: stats.size,
              modified: stats.mtime
            });
          } catch (error) {
            log.warn('无法读取视频文件信息:', file, error.message);
          }
        }
      }

      // 按修改时间排序
      videos.sort((a, b) => b.modified - a.modified);

      log.info(`找到 ${videos.length} 个视频文件`);
      return videos;
    } catch (error) {
      log.error('获取视频列表失败:', error);
      return [];
    }
  }

  async validateVideo(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const ext = path.extname(filePath).toLowerCase();
      
      if (!stats.isFile()) {
        return { valid: false, error: '不是有效的文件' };
      }
      
      if (!this.supportedFormats.includes(ext)) {
        return { valid: false, error: '不支持的文件格式' };
      }

      // 检查文件大小（最大 500MB）
      const maxSize = 500 * 1024 * 1024;
      if (stats.size > maxSize) {
        return { valid: false, error: '文件过大（最大 500MB）' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  getVideoUrl(filePath) {
    // 将文件路径转换为 file:// URL
    return 'file://' + path.resolve(filePath).replace(/\\/g, '/');
  }

  async getVideoThumbnail(videoPath, time = 0) {
    // 这里可以实现视频缩略图生成（可选）
    // 可以使用 FFmpeg 提取帧
    return null;
  }

  clearCache() {
    this.videoCache.clear();
    log.info('视频缓存已清除');
  }
}

module.exports = VideoManager;
