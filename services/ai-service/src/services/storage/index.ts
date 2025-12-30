/**
 * Storage Service - 通用文件存储管理
 * 支持分类存储、JSON 文件管理
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * 存储接口定义
 */
export interface IStorage<T> {
  get(id: string): Promise<T | null>;
  save(item: T): Promise<void>;
  delete(id: string): Promise<boolean>;
  list(): Promise<T[]>;
  clear(): Promise<void>;
}

/**
 * 存储配置
 */
export interface StorageConfig {
  /** 存储目录名（相对于基础目录） */
  name: string;
  /** 基础目录，默认为用户数据目录 */
  baseDir?: string;
  /** 文件扩展名，默认 .json */
  extension?: string;
}

/**
 * 获取默认数据目录
 */
export function getDefaultDataDir(): string {
  const homeDir = os.homedir();
  return path.join(homeDir, '.config', 'req-auto-mgmt-electron', 'data');
}

/**
 * JSON 文件存储实现
 * 每个数据项保存为单独的 JSON 文件
 */
export class JsonFileStorage<T extends { id: string }> implements IStorage<T> {
  private storageDir: string;
  private extension: string;
  private initialized = false;

  constructor(config: StorageConfig) {
    const baseDir = config.baseDir || getDefaultDataDir();
    this.storageDir = path.join(baseDir, config.name);
    this.extension = config.extension || '.json';
  }

  /**
   * 确保存储目录存在
   */
  private ensureDir(): void {
    if (this.initialized) return;

    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
      console.log(`[Storage] Created directory: ${this.storageDir}`);
    }
    this.initialized = true;
  }

  /**
   * 获取文件路径
   */
  private getFilePath(id: string): string {
    // 清理 ID，避免路径注入
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.storageDir, `${safeId}${this.extension}`);
  }

  /**
   * 获取单个数据项
   */
  async get(id: string): Promise<T | null> {
    this.ensureDir();

    const filePath = this.getFilePath(id);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch (err) {
      console.error(`[Storage] Failed to read ${id}:`, err);
      return null;
    }
  }

  /**
   * 保存数据项
   */
  async save(item: T): Promise<void> {
    this.ensureDir();

    const filePath = this.getFilePath(item.id);

    try {
      fs.writeFileSync(filePath, JSON.stringify(item, null, 2), 'utf-8');
      console.log(`[Storage] Saved: ${item.id}`);
    } catch (err) {
      console.error(`[Storage] Failed to save ${item.id}:`, err);
      throw err;
    }
  }

  /**
   * 删除数据项
   */
  async delete(id: string): Promise<boolean> {
    this.ensureDir();

    const filePath = this.getFilePath(id);

    if (!fs.existsSync(filePath)) {
      return false;
    }

    try {
      fs.unlinkSync(filePath);
      console.log(`[Storage] Deleted: ${id}`);
      return true;
    } catch (err) {
      console.error(`[Storage] Failed to delete ${id}:`, err);
      return false;
    }
  }

  /**
   * 列出所有数据项
   */
  async list(): Promise<T[]> {
    this.ensureDir();

    const items: T[] = [];

    try {
      const files = fs.readdirSync(this.storageDir);

      for (const file of files) {
        if (!file.endsWith(this.extension)) continue;

        const filePath = path.join(this.storageDir, file);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const item = JSON.parse(content) as T;
          items.push(item);
        } catch (err) {
          console.error(`[Storage] Failed to read file ${file}:`, err);
        }
      }
    } catch (err) {
      console.error('[Storage] Failed to list items:', err);
    }

    return items;
  }

  /**
   * 清空所有数据
   */
  async clear(): Promise<void> {
    this.ensureDir();

    try {
      const files = fs.readdirSync(this.storageDir);

      for (const file of files) {
        if (!file.endsWith(this.extension)) continue;
        const filePath = path.join(this.storageDir, file);
        fs.unlinkSync(filePath);
      }

      console.log(`[Storage] Cleared all items in ${this.storageDir}`);
    } catch (err) {
      console.error('[Storage] Failed to clear:', err);
      throw err;
    }
  }

  /**
   * 获取存储目录路径
   */
  getStorageDir(): string {
    return this.storageDir;
  }

  /**
   * 获取存储统计信息
   */
  async getStats(): Promise<{ count: number; totalSize: number; directory: string }> {
    this.ensureDir();

    let count = 0;
    let totalSize = 0;

    try {
      const files = fs.readdirSync(this.storageDir);

      for (const file of files) {
        if (!file.endsWith(this.extension)) continue;

        const filePath = path.join(this.storageDir, file);
        const stat = fs.statSync(filePath);
        count++;
        totalSize += stat.size;
      }
    } catch (err) {
      console.error('[Storage] Failed to get stats:', err);
    }

    return {
      count,
      totalSize,
      directory: this.storageDir,
    };
  }
}

/**
 * 索引文件存储实现
 * 所有数据保存在一个 JSON 文件中（适合小量数据）
 */
export class IndexedJsonStorage<T extends { id: string }> implements IStorage<T> {
  private filePath: string;
  private data: Map<string, T> = new Map();
  private initialized = false;

  constructor(config: StorageConfig) {
    const baseDir = config.baseDir || getDefaultDataDir();
    const dir = path.join(baseDir, config.name);

    // 确保目录存在
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.filePath = path.join(dir, `index${config.extension || '.json'}`);
  }

  /**
   * 加载数据
   */
  private load(): void {
    if (this.initialized) return;

    if (fs.existsSync(this.filePath)) {
      try {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        const items = JSON.parse(content) as T[];

        for (const item of items) {
          this.data.set(item.id, item);
        }

        console.log(`[Storage] Loaded ${items.length} items from ${this.filePath}`);
      } catch (err) {
        console.error('[Storage] Failed to load index file:', err);
      }
    }

    this.initialized = true;
  }

  /**
   * 保存数据到文件
   */
  private persist(): void {
    try {
      const items = Array.from(this.data.values());
      fs.writeFileSync(this.filePath, JSON.stringify(items, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Storage] Failed to persist:', err);
      throw err;
    }
  }

  async get(id: string): Promise<T | null> {
    this.load();
    return this.data.get(id) || null;
  }

  async save(item: T): Promise<void> {
    this.load();
    this.data.set(item.id, item);
    this.persist();
    console.log(`[Storage] Saved: ${item.id}`);
  }

  async delete(id: string): Promise<boolean> {
    this.load();
    const existed = this.data.has(id);
    if (existed) {
      this.data.delete(id);
      this.persist();
      console.log(`[Storage] Deleted: ${id}`);
    }
    return existed;
  }

  async list(): Promise<T[]> {
    this.load();
    return Array.from(this.data.values());
  }

  async clear(): Promise<void> {
    this.data.clear();
    this.persist();
    console.log('[Storage] Cleared all items');
  }

  /**
   * 获取文件路径
   */
  getFilePath(): string {
    return this.filePath;
  }
}
