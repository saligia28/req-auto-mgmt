/**
 * TAPD Service Manager
 * Manages TAPD client in the main process
 */

import https from 'https';
import http from 'http';

// TAPD 配置
export interface TapdConfig {
  apiBase: string;
  workspaceId: string;
  token?: string;
  username?: string;
  password?: string;
}

// 迭代
export interface TapdIteration {
  id: string;
  name: string;
  status?: string;
  startdate?: string;
  enddate?: string;
}

// 需求摘要
export interface StorySummary {
  id: string;
  title: string;
  status?: string | null;
  statusLabel?: string | null;
  owners: string[];
  frontend?: string | null;
  iteration?: string | null;
  iterationId?: string | null;
  updatedAt?: string | null;
  url?: string | null;
}

// 需求详情
export interface StoryDetail extends StorySummary {
  description: string;
  priority?: string;
  creator?: string;
  createdAt?: string;
  module?: string;
}

// 状态映射
const STATUS_VALUE_MAP: Record<string, string> = {
  'planning': '规划中',
  'status_8': '待开发',
  'status_2': '开发中',
  'status_4': '联调中',
  'status_5': '联调完成',
  'status_12': '已提测',
  'status_6': '测试中',
  'status_7': '测试完成',
  'status_10': '产品验收',
  'status_3': '已完成',
  'status_11': '关闭',
};

// 负责人字段候选
const OWNER_KEY_CANDIDATES = ['owner', 'assignee', 'current_owner', '负责人', '处理人'];

export class TapdService {
  private config: TapdConfig | null = null;
  private iterationCache: { data: TapdIteration[]; timestamp: number } | null = null;
  private iterationCacheTtl = 60 * 1000;

  /**
   * 更新配置
   */
  setConfig(config: TapdConfig): void {
    this.config = config;
    this.clearCache();
  }

  /**
   * 获取配置
   */
  getConfig(): TapdConfig | null {
    return this.config;
  }

  /**
   * 验证配置是否完整
   */
  isConfigured(): boolean {
    if (!this.config?.workspaceId) return false;
    if (!this.config.token && (!this.config.username || !this.config.password)) {
      return false;
    }
    return true;
  }

  /**
   * 发送 HTTP 请求
   */
  private async request<T>(path: string, params?: Record<string, string | number>): Promise<T> {
    if (!this.config) {
      throw new Error('TAPD not configured');
    }

    const url = new URL(path, this.config.apiBase);

    if (params && !params.workspace_id) {
      params.workspace_id = this.config.workspaceId;
    }

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

      let authHeader: string;
      if (this.config!.token) {
        authHeader = `Bearer ${this.config!.token}`;
      } else if (this.config!.username && this.config!.password) {
        const credentials = Buffer.from(`${this.config!.username}:${this.config!.password}`).toString('base64');
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
    if (!this.isConfigured()) {
      throw new Error('TAPD not configured');
    }

    if (this.iterationCache && Date.now() - this.iterationCache.timestamp < this.iterationCacheTtl) {
      return this.iterationCache.data;
    }

    const response = await this.request<{ data: any[] }>('/iterations', {
      workspace_id: this.config!.workspaceId,
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

    this.iterationCache = { data: iterations, timestamp: Date.now() };
    return iterations;
  }

  /**
   * 获取当前迭代
   */
  async getCurrentIteration(): Promise<TapdIteration | null> {
    const iterations = await this.getIterations();
    if (iterations.length === 0) return null;

    const now = new Date();

    for (const iter of iterations) {
      const status = String(iter.status || '').toLowerCase();
      if (['doing', 'in_progress', 'processing', 'open'].includes(status)) {
        return iter;
      }
    }

    for (const iter of iterations) {
      const startDate = iter.startdate ? new Date(iter.startdate) : null;
      const endDate = iter.enddate ? new Date(iter.enddate) : null;
      if (startDate && endDate && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        if (now >= startDate && now <= endDate) {
          return iter;
        }
      }
    }

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
    if (!this.isConfigured()) {
      throw new Error('TAPD not configured');
    }

    const params: Record<string, string | number> = {
      workspace_id: this.config!.workspaceId,
      limit: options.limit || 100,
      with_v_status: 1,
    };

    if (options.iterationId) {
      params.iteration_id = options.iterationId;
    }
    if (options.status) {
      params.status = options.status;
    }

    const response = await this.request<{ data: any[] }>('/stories', params);
    const stories: StorySummary[] = [];

    for (const item of response?.data || []) {
      const story = item.Story || item;
      if (story?.id) {
        stories.push(this.processStorySummary(story));
      }
    }

    return stories;
  }

  /**
   * 获取需求详情
   */
  async getStory(id: string): Promise<StoryDetail | null> {
    if (!this.isConfigured()) {
      throw new Error('TAPD not configured');
    }

    try {
      const response = await this.request<{ data: any }>(`/stories/${id}`, {
        workspace_id: this.config!.workspaceId,
        with_v_status: 1,
      });

      const data = response?.data;
      if (!data) return null;

      let raw: any = null;
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
      try {
        const response = await this.request<{ data: any }>('/stories', {
          workspace_id: this.config!.workspaceId,
          id: id,
          with_v_status: 1,
        });

        const data = response?.data;
        if (!data) return null;

        let raw: any = null;
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

  private processStorySummary(raw: any): StorySummary {
    return {
      id: raw.id,
      title: raw.name || raw.title || '',
      status: raw.status,
      statusLabel: this.extractStatusLabel(raw),
      owners: this.extractOwners(raw),
      frontend: raw.custom_field_four || null,
      iteration: null,
      iterationId: raw.iteration_id || null,
      updatedAt: raw.modified || null,
      url: `https://www.tapd.cn/${this.config!.workspaceId}/prong/stories/view/${raw.id}`,
    };
  }

  private processStoryDetail(raw: any): StoryDetail {
    return {
      ...this.processStorySummary(raw),
      description: raw.description || '',
      priority: raw.priority,
      creator: raw.creator,
      createdAt: raw.created,
      module: raw.module,
    };
  }

  private extractOwners(story: any): string[] {
    const owners: string[] = [];
    for (const key of OWNER_KEY_CANDIDATES) {
      const value = story[key];
      if (value) {
        if (typeof value === 'string') {
          owners.push(value.trim());
        } else if (Array.isArray(value)) {
          owners.push(...value.map(v => String(v).trim()));
        }
      }
    }
    return [...new Set(owners.filter(Boolean))];
  }

  private extractStatusLabel(story: any): string {
    if (story.v_status && typeof story.v_status === 'string') {
      return story.v_status.trim();
    }
    const status = story.status;
    if (status) {
      const normalized = String(status).trim().toLowerCase();
      const key = /^\d+$/.test(normalized) ? `status_${normalized}` : normalized;
      if (STATUS_VALUE_MAP[key]) {
        return STATUS_VALUE_MAP[key];
      }
    }
    return status || '';
  }

  clearCache(): void {
    this.iterationCache = null;
  }
}

// 单例
export const tapdService = new TapdService();
