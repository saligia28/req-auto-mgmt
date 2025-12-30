/**
 * TAPD API Client
 * Handles all TAPD API interactions
 */

import https from 'https';
import http from 'http';
import type {
  TapdConfig,
  TapdIteration,
  TapdStoryRaw,
  StorySummary,
  StoryDetail,
} from '../types/index.js';
import { STATUS_VALUE_MAP } from '../types/index.js';

// Re-export STATUS_VALUE_MAP
export { STATUS_VALUE_MAP };

// 默认 API 路径
const API_PATHS = {
  stories: '/stories',
  iterations: '/iterations',
};

// 负责人字段候选
const OWNER_KEY_CANDIDATES = [
  'owner', 'assignee', 'current_owner', 'owners',
  '负责人', '处理人', '当前处理人',
];

export class TapdClient {
  private config: TapdConfig;
  private iterationCache: { data: TapdIteration[]; timestamp: number } | null = null;
  private iterationCacheTtl = 60 * 1000; // 1分钟

  constructor(config: TapdConfig) {
    this.config = config;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<TapdConfig>): void {
    this.config = { ...this.config, ...config };
    this.clearCache();
  }

  /**
   * 验证配置是否完整
   */
  isConfigured(): boolean {
    if (!this.config.workspaceId) return false;
    if (!this.config.token && (!this.config.username || !this.config.password)) {
      return false;
    }
    return true;
  }

  /**
   * 发送 HTTP 请求
   */
  private async request<T>(path: string, params?: Record<string, string | number>): Promise<T> {
    const url = new URL(path, this.config.apiBase);

    // 添加 workspace_id
    if (params && !params.workspace_id) {
      params.workspace_id = this.config.workspaceId;
    }

    // 添加查询参数
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.set(key, String(value));
        }
      });
    }

    return new Promise((resolve, reject) => {
      const isHttps = url.protocol === 'https:';
      const lib = isHttps ? https : http;

      // 构建认证头
      let authHeader: string;
      if (this.config.token) {
        authHeader = `Bearer ${this.config.token}`;
      } else if (this.config.username && this.config.password) {
        const credentials = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
        authHeader = `Basic ${credentials}`;
      } else {
        reject(new Error('TAPD authentication not configured'));
        return;
      }

      const options: http.RequestOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json',
        },
      };

      const req = lib.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`TAPD API error: ${res.statusCode} - ${body}`));
            } else {
              resolve(data);
            }
          } catch {
            reject(new Error(`Failed to parse TAPD response: ${body}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('TAPD API request timeout'));
      });
      req.end();
    });
  }

  /**
   * 获取迭代列表
   */
  async getIterations(): Promise<TapdIteration[]> {
    // 检查缓存
    if (this.iterationCache && Date.now() - this.iterationCache.timestamp < this.iterationCacheTtl) {
      return this.iterationCache.data;
    }

    try {
      const response = await this.request<{ data: any[] }>(API_PATHS.iterations, {
        workspace_id: this.config.workspaceId,
      });

      const iterations: TapdIteration[] = [];
      for (const item of response?.data || []) {
        const iter = item.Iteration || item;
        if (iter?.id) {
          iterations.push({
            id: iter.id,
            name: iter.name || `迭代 ${iter.id}`,
            status: iter.status,
            startdate: iter.startdate,
            enddate: iter.enddate,
          });
        }
      }

      // 更新缓存
      this.iterationCache = {
        data: iterations,
        timestamp: Date.now(),
      };

      return iterations;
    } catch (err) {
      console.error('Failed to get iterations:', err);
      throw err;
    }
  }

  /**
   * 获取当前迭代
   */
  async getCurrentIteration(): Promise<TapdIteration | null> {
    const iterations = await this.getIterations();
    if (iterations.length === 0) return null;

    const now = new Date();

    // 优先级1：检查显式的当前标志
    for (const iter of iterations) {
      const status = String(iter.status || '').toLowerCase();
      if (['doing', 'in_progress', 'processing', 'open'].includes(status)) {
        return iter;
      }
    }

    // 优先级2：检查时间窗口
    for (const iter of iterations) {
      const startDate = this.parseDate(iter.startdate);
      const endDate = this.parseDate(iter.enddate);
      if (startDate && endDate && now >= startDate && now <= endDate) {
        return iter;
      }
    }

    // 优先级3：返回第一个
    return iterations[0] || null;
  }

  /**
   * 获取需求列表
   */
  async getStories(options: {
    iterationId?: string;
    status?: string;
    limit?: number;
  } = {}): Promise<StorySummary[]> {
    const params: Record<string, string | number> = {
      workspace_id: this.config.workspaceId,
      limit: options.limit || 100,
      with_v_status: 1,
    };

    if (options.iterationId) {
      params.iteration_id = options.iterationId;
    }
    if (options.status) {
      params.status = options.status;
    }

    try {
      const response = await this.request<{ data: any[] }>(API_PATHS.stories, params);
      const stories: StorySummary[] = [];

      for (const item of response?.data || []) {
        const story = item.Story || item;
        if (story?.id) {
          stories.push(this.processStorySummary(story as TapdStoryRaw));
        }
      }

      return stories;
    } catch (err) {
      console.error('Failed to get stories:', err);
      throw err;
    }
  }

  /**
   * 获取需求详情
   */
  async getStory(id: string): Promise<StoryDetail | null> {
    try {
      // 尝试路径格式
      const response = await this.request<{ data: any }>(
        `${API_PATHS.stories}/${id}`,
        {
          workspace_id: this.config.workspaceId,
          with_v_status: 1,
        }
      );

      const data = response?.data;
      if (!data) return null;

      let raw: TapdStoryRaw | null = null;
      if (data.Story) {
        raw = data.Story;
      } else if (Array.isArray(data) && data.length > 0) {
        raw = data[0].Story || data[0];
      } else if (data.id) {
        raw = data;
      }

      if (!raw) return null;
      return this.processStoryDetail(raw);
    } catch {
      // 尝试查询参数格式
      try {
        const response = await this.request<{ data: any }>(API_PATHS.stories, {
          workspace_id: this.config.workspaceId,
          id: id,
          with_v_status: 1,
        });

        const data = response?.data;
        if (!data) return null;

        let raw: TapdStoryRaw | null = null;
        if (Array.isArray(data) && data.length > 0) {
          raw = data[0].Story || data[0];
        } else if (data.Story) {
          raw = data.Story;
        } else if (data.id) {
          raw = data;
        }

        if (!raw) return null;
        return this.processStoryDetail(raw);
      } catch (err) {
        console.error(`Failed to get story ${id}:`, err);
        return null;
      }
    }
  }

  /**
   * 处理需求摘要
   */
  private processStorySummary(raw: TapdStoryRaw): StorySummary {
    return {
      id: raw.id,
      title: raw.name || raw.title || '',
      status: raw.status,
      statusLabel: this.extractStatusLabel(raw),
      owners: this.extractOwners(raw),
      frontend: raw.custom_field_four || null,
      iteration: null, // 需要额外查询
      iterationId: raw.iteration_id || null,
      updatedAt: raw.modified || null,
      url: this.buildStoryUrl(raw.id),
    };
  }

  /**
   * 处理需求详情
   */
  private processStoryDetail(raw: TapdStoryRaw): StoryDetail {
    return {
      ...this.processStorySummary(raw),
      description: raw.description || '',
      priority: raw.priority,
      creator: raw.creator,
      createdAt: raw.created,
      module: raw.module,
      raw,
    };
  }

  /**
   * 提取负责人
   */
  private extractOwners(story: TapdStoryRaw): string[] {
    const owners: string[] = [];
    for (const key of OWNER_KEY_CANDIDATES) {
      const value = story[key];
      if (value) {
        owners.push(...this.flattenStrings(value));
      }
    }
    return this.dedupPreserveOrder(owners);
  }

  /**
   * 提取状态标签
   */
  private extractStatusLabel(story: TapdStoryRaw): string {
    // 尝试 v_status 字段
    if (story.v_status && typeof story.v_status === 'string') {
      return story.v_status.trim();
    }

    // 尝试映射 status
    const status = story.status;
    if (status) {
      const normalized = this.normalizeStatusKey(status);
      if (STATUS_VALUE_MAP[normalized]) {
        return STATUS_VALUE_MAP[normalized];
      }
    }

    return status || '';
  }

  // ============= 辅助方法 =============

  private parseDate(value: string | undefined): Date | null {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  private flattenStrings(value: any): string[] {
    if (value === null || value === undefined) return [];
    if (typeof value === 'string') {
      const stripped = value.trim();
      return stripped ? [stripped] : [];
    }
    if (Array.isArray(value)) {
      const out: string[] = [];
      for (const item of value) {
        out.push(...this.flattenStrings(item));
      }
      return out;
    }
    return [String(value)];
  }

  private dedupPreserveOrder(items: (string | null | undefined)[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of items) {
      if (!item) continue;
      const text = String(item).trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);
      out.push(text);
    }
    return out;
  }

  private normalizeStatusKey(raw: string): string {
    if (!raw) return '';
    const low = String(raw).trim().toLowerCase();
    if (/^\d+$/.test(low)) {
      return `status_${parseInt(low, 10)}`;
    }
    return low;
  }

  private buildStoryUrl(storyId: string): string {
    return `https://www.tapd.cn/${this.config.workspaceId}/prong/stories/view/${storyId}`;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.iterationCache = null;
  }
}

// 单例实例
let clientInstance: TapdClient | null = null;

/**
 * 获取或创建客户端实例
 */
export function getTapdClient(config?: TapdConfig): TapdClient {
  if (!clientInstance && config) {
    clientInstance = new TapdClient(config);
  }
  if (!clientInstance) {
    throw new Error('TapdClient not initialized');
  }
  return clientInstance;
}

/**
 * 更新客户端配置
 */
export function updateTapdConfig(config: Partial<TapdConfig>): void {
  if (clientInstance) {
    clientInstance.updateConfig(config);
  }
}

/**
 * 重置客户端
 */
export function resetTapdClient(): void {
  clientInstance = null;
}
