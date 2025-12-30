/**
 * Storage Cleanup Manager
 * 统一管理应用数据的清理功能
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

/**
 * 清理类型
 */
export type CleanupType = 'prompts' | 'logs' | 'cache' | 'all';

/**
 * 清理选项
 */
export interface CleanupOptions {
  /** 清理类型 */
  type: CleanupType;
  /** 只清理 N 天前的数据 */
  olderThanDays?: number;
  /** 保留默认数据 */
  keepDefaults?: boolean;
}

/**
 * 清理结果
 */
export interface CleanupResult {
  success: boolean;
  type: CleanupType;
  deletedCount: number;
  freedBytes: number;
  errors?: string[];
}

/**
 * 存储统计信息
 */
export interface StorageStats {
  prompts: { count: number; size: number; path: string };
  logs: { count: number; size: number; path: string };
  cache: { count: number; size: number; path: string };
  config: { count: number; size: number; path: string };
  total: { count: number; size: number };
}

class StorageCleanupManager {
  private dataDir: string = '';
  private initialized = false;

  /**
   * 初始化
   */
  init(): void {
    if (this.initialized) return;

    this.dataDir = path.join(app.getPath('userData'), 'data');
    this.initialized = true;

    console.log('[StorageCleanupManager] Initialized');
    console.log('[StorageCleanupManager] Data directory:', this.dataDir);
  }

  /**
   * 获取数据目录
   */
  getDataDir(): string {
    return this.dataDir;
  }

  /**
   * 获取各类数据的路径
   */
  private getPaths() {
    const userDataPath = app.getPath('userData');
    return {
      prompts: path.join(this.dataDir, 'prompts'),
      logs: path.join(userDataPath, 'logs'),
      cache: path.join(this.dataDir, 'cache'),
      config: path.join(userDataPath, 'config'),
    };
  }

  /**
   * 获取存储统计信息
   */
  async getStats(): Promise<StorageStats> {
    this.init();

    const paths = this.getPaths();
    const stats: StorageStats = {
      prompts: { count: 0, size: 0, path: paths.prompts },
      logs: { count: 0, size: 0, path: paths.logs },
      cache: { count: 0, size: 0, path: paths.cache },
      config: { count: 0, size: 0, path: paths.config },
      total: { count: 0, size: 0 },
    };

    for (const [key, dirPath] of Object.entries(paths)) {
      const dirStats = this.getDirStats(dirPath);
      const category = stats[key as keyof typeof paths];
      category.count = dirStats.count;
      category.size = dirStats.size;
      stats.total.count += dirStats.count;
      stats.total.size += dirStats.size;
    }

    return stats;
  }

  /**
   * 获取目录统计
   */
  private getDirStats(dirPath: string): { count: number; size: number } {
    let count = 0;
    let size = 0;

    if (!fs.existsSync(dirPath)) {
      return { count, size };
    }

    try {
      const items = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);

        if (item.isFile()) {
          count++;
          try {
            const stat = fs.statSync(itemPath);
            size += stat.size;
          } catch {
            // ignore
          }
        } else if (item.isDirectory()) {
          const subStats = this.getDirStats(itemPath);
          count += subStats.count;
          size += subStats.size;
        }
      }
    } catch {
      // ignore
    }

    return { count, size };
  }

  /**
   * 执行清理
   */
  async cleanup(options: CleanupOptions): Promise<CleanupResult> {
    this.init();

    const result: CleanupResult = {
      success: true,
      type: options.type,
      deletedCount: 0,
      freedBytes: 0,
      errors: [],
    };

    const paths = this.getPaths();

    try {
      if (options.type === 'all' || options.type === 'prompts') {
        const promptResult = await this.cleanupDirectory(
          paths.prompts,
          options.olderThanDays,
          options.keepDefaults ? ['default.json', 'index.json'] : []
        );
        result.deletedCount += promptResult.deleted;
        result.freedBytes += promptResult.bytes;
        if (promptResult.errors.length > 0) {
          result.errors!.push(...promptResult.errors);
        }
      }

      if (options.type === 'all' || options.type === 'logs') {
        const logsResult = await this.cleanupDirectory(
          paths.logs,
          options.olderThanDays
        );
        result.deletedCount += logsResult.deleted;
        result.freedBytes += logsResult.bytes;
        if (logsResult.errors.length > 0) {
          result.errors!.push(...logsResult.errors);
        }
      }

      if (options.type === 'all' || options.type === 'cache') {
        const cacheResult = await this.cleanupDirectory(
          paths.cache,
          options.olderThanDays
        );
        result.deletedCount += cacheResult.deleted;
        result.freedBytes += cacheResult.bytes;
        if (cacheResult.errors.length > 0) {
          result.errors!.push(...cacheResult.errors);
        }
      }

      if (result.errors!.length > 0) {
        result.success = false;
      }
    } catch (err) {
      result.success = false;
      result.errors!.push(err instanceof Error ? err.message : String(err));
    }

    console.log(`[StorageCleanupManager] Cleanup completed:`, {
      type: options.type,
      deleted: result.deletedCount,
      freed: this.formatBytes(result.freedBytes),
    });

    return result;
  }

  /**
   * 清理指定目录
   */
  private async cleanupDirectory(
    dirPath: string,
    olderThanDays?: number,
    excludeFiles: string[] = []
  ): Promise<{ deleted: number; bytes: number; errors: string[] }> {
    const result = { deleted: 0, bytes: 0, errors: [] as string[] };

    if (!fs.existsSync(dirPath)) {
      return result;
    }

    const cutoffTime = olderThanDays
      ? Date.now() - olderThanDays * 24 * 60 * 60 * 1000
      : 0;

    try {
      const items = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);

        // 跳过排除的文件
        if (excludeFiles.includes(item.name)) {
          continue;
        }

        try {
          const stat = fs.statSync(itemPath);

          // 检查时间过滤
          if (olderThanDays && stat.mtimeMs > cutoffTime) {
            continue;
          }

          if (item.isFile()) {
            result.bytes += stat.size;
            fs.unlinkSync(itemPath);
            result.deleted++;
          } else if (item.isDirectory()) {
            // 递归清理子目录
            const subResult = await this.cleanupDirectory(itemPath, olderThanDays, excludeFiles);
            result.deleted += subResult.deleted;
            result.bytes += subResult.bytes;
            result.errors.push(...subResult.errors);

            // 如果目录为空则删除
            const remaining = fs.readdirSync(itemPath);
            if (remaining.length === 0) {
              fs.rmdirSync(itemPath);
            }
          }
        } catch (err) {
          result.errors.push(`Failed to delete ${itemPath}: ${err}`);
        }
      }
    } catch (err) {
      result.errors.push(`Failed to read directory ${dirPath}: ${err}`);
    }

    return result;
  }

  /**
   * 格式化字节数
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
  }

  /**
   * 获取可清理项目列表
   */
  async getCleanableItems(): Promise<{
    type: CleanupType;
    name: string;
    description: string;
    count: number;
    size: number;
    canClean: boolean;
  }[]> {
    const stats = await this.getStats();

    return [
      {
        type: 'prompts' as CleanupType,
        name: 'Prompt 模板',
        description: '自定义的 AI 分析模板（保留默认模板）',
        count: stats.prompts.count,
        size: stats.prompts.size,
        canClean: stats.prompts.count > 1,
      },
      {
        type: 'logs' as CleanupType,
        name: '日志文件',
        description: '终端会话日志和应用日志',
        count: stats.logs.count,
        size: stats.logs.size,
        canClean: stats.logs.count > 0,
      },
      {
        type: 'cache' as CleanupType,
        name: '缓存数据',
        description: 'API 缓存和临时数据',
        count: stats.cache.count,
        size: stats.cache.size,
        canClean: stats.cache.count > 0,
      },
    ];
  }
}

// 单例导出
export const storageCleanupManager = new StorageCleanupManager();
