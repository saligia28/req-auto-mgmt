/**
 * Prompt Storage - Prompt 模板存储管理
 */

import { IndexedJsonStorage } from './index.js';
import type { PromptTemplate } from '../../types/index.js';
import { DEFAULT_ANALYSIS_PROMPT } from '../../types/index.js';

/**
 * 默认 Prompt 模板
 */
const DEFAULT_PROMPT: PromptTemplate = {
  id: 'default',
  name: '默认分析模板',
  template: DEFAULT_ANALYSIS_PROMPT,
  isDefault: true,
  createdAt: new Date().toISOString(),
};

/**
 * Prompt 模板存储
 */
class PromptStorage {
  private storage: IndexedJsonStorage<PromptTemplate>;
  private initialized = false;

  constructor() {
    this.storage = new IndexedJsonStorage<PromptTemplate>({
      name: 'prompts',
    });
  }

  /**
   * 初始化存储
   * 确保默认模板存在
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    const items = await this.storage.list();

    // 如果没有任何模板，添加默认模板
    if (items.length === 0) {
      await this.storage.save(DEFAULT_PROMPT);
      console.log('[PromptStorage] Created default prompt template');
    }

    // 确保默认模板存在
    const defaultExists = items.some(p => p.id === 'default');
    if (!defaultExists && items.length > 0) {
      await this.storage.save(DEFAULT_PROMPT);
      console.log('[PromptStorage] Restored default prompt template');
    }

    this.initialized = true;
    console.log('[PromptStorage] Initialized');
  }

  /**
   * 获取所有模板
   */
  async list(): Promise<PromptTemplate[]> {
    await this.init();
    const items = await this.storage.list();

    // 按创建时间排序，默认模板在最前
    return items.sort((a, b) => {
      if (a.isDefault) return -1;
      if (b.isDefault) return 1;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  /**
   * 获取单个模板
   */
  async get(id: string): Promise<PromptTemplate | null> {
    await this.init();
    return this.storage.get(id);
  }

  /**
   * 创建新模板
   */
  async create(name: string, template: string): Promise<PromptTemplate> {
    await this.init();

    const newPrompt: PromptTemplate = {
      id: Date.now().toString(),
      name,
      template,
      isDefault: false,
      createdAt: new Date().toISOString(),
    };

    await this.storage.save(newPrompt);
    console.log(`[PromptStorage] Created prompt: ${newPrompt.id}`);

    return newPrompt;
  }

  /**
   * 更新模板
   */
  async update(id: string, updates: { name?: string; template?: string }): Promise<PromptTemplate | null> {
    await this.init();

    const existing = await this.storage.get(id);
    if (!existing) {
      return null;
    }

    const updated: PromptTemplate = {
      ...existing,
      name: updates.name ?? existing.name,
      template: updates.template ?? existing.template,
      updatedAt: new Date().toISOString(),
    };

    await this.storage.save(updated);
    console.log(`[PromptStorage] Updated prompt: ${id}`);

    return updated;
  }

  /**
   * 删除模板
   */
  async delete(id: string): Promise<{ success: boolean; error?: string }> {
    await this.init();

    const existing = await this.storage.get(id);
    if (!existing) {
      return { success: false, error: '模板不存在' };
    }

    if (existing.isDefault) {
      return { success: false, error: '不能删除默认模板' };
    }

    await this.storage.delete(id);
    console.log(`[PromptStorage] Deleted prompt: ${id}`);

    return { success: true };
  }

  /**
   * 重置默认模板
   */
  async resetDefault(): Promise<PromptTemplate> {
    await this.init();

    await this.storage.save(DEFAULT_PROMPT);
    console.log('[PromptStorage] Reset default prompt template');

    return DEFAULT_PROMPT;
  }

  /**
   * 清空所有自定义模板（保留默认）
   */
  async clearCustom(): Promise<number> {
    await this.init();

    const items = await this.storage.list();
    let deleted = 0;

    for (const item of items) {
      if (!item.isDefault) {
        await this.storage.delete(item.id);
        deleted++;
      }
    }

    console.log(`[PromptStorage] Cleared ${deleted} custom prompts`);
    return deleted;
  }

  /**
   * 获取存储统计信息
   */
  async getStats(): Promise<{ total: number; custom: number; storagePath: string }> {
    await this.init();

    const items = await this.storage.list();
    const custom = items.filter(p => !p.isDefault).length;

    return {
      total: items.length,
      custom,
      storagePath: this.storage.getFilePath(),
    };
  }
}

// 单例导出
export const promptStorage = new PromptStorage();
