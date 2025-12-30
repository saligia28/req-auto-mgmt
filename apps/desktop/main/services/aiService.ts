/**
 * AI Service Client
 * 与 AI 微服务通信的客户端
 */

import type { AIModelConfig } from '@req-auto-mgmt/shared-types';

const AI_SERVICE_URL = 'http://localhost:3402';

/**
 * AI 分析结果
 */
interface AnalysisResult {
  summary: string;
  testCases: string[];
  analyzedAt: string;
  model: string;
  provider: string;
}

/**
 * AI 服务客户端
 */
class AIService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = AI_SERVICE_URL;
  }

  /**
   * 分析需求内容
   */
  async analyze(content: string): Promise<{
    success: boolean;
    result?: AnalysisResult;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[AI Service] Analyze error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'AI 服务连接失败',
      };
    }
  }

  /**
   * 测试 AI 连接
   */
  async testConnection(): Promise<{
    success: boolean;
    message?: string;
    latency?: number;
    error?: string;
  }> {
    try {
      const startTime = Date.now();
      const response = await fetch(`${this.baseUrl}/api/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const latency = Date.now() - startTime;
      const data = await response.json();

      return {
        ...data,
        latency: data.latency || latency,
      };
    } catch (error) {
      console.error('[AI Service] Test connection error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'AI 服务连接失败',
      };
    }
  }

  /**
   * 更新 AI 配置
   */
  async updateConfig(config: AIModelConfig): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[AI Service] Update config error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'AI 服务连接失败',
      };
    }
  }

  /**
   * 获取当前 AI 配置
   */
  async getConfig(): Promise<{
    success: boolean;
    config?: AIModelConfig;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/config`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[AI Service] Get config error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'AI 服务连接失败',
      };
    }
  }

  /**
   * 获取 AI 服务状态
   */
  async getStatus(): Promise<{
    success: boolean;
    status?: {
      provider: string;
      available: boolean;
      model: string;
    };
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[AI Service] Get status error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'AI 服务连接失败',
      };
    }
  }

  /**
   * 获取可用模型列表
   */
  async getModels(): Promise<{
    success: boolean;
    models?: { provider: string; models: string[] }[];
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[AI Service] Get models error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'AI 服务连接失败',
      };
    }
  }

  /**
   * 获取所有 Prompt 模板
   */
  async getPrompts(): Promise<{
    success: boolean;
    prompts?: PromptTemplate[];
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/prompts`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[AI Service] Get prompts error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'AI 服务连接失败',
      };
    }
  }

  /**
   * 创建 Prompt 模板
   */
  async createPrompt(prompt: { name: string; template: string }): Promise<{
    success: boolean;
    prompt?: PromptTemplate;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/prompts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(prompt),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[AI Service] Create prompt error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'AI 服务连接失败',
      };
    }
  }

  /**
   * 更新 Prompt 模板
   */
  async updatePrompt(id: string, updates: { name?: string; template?: string }): Promise<{
    success: boolean;
    prompt?: PromptTemplate;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/prompts/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[AI Service] Update prompt error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'AI 服务连接失败',
      };
    }
  }

  /**
   * 删除 Prompt 模板
   */
  async deletePrompt(id: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/prompts/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[AI Service] Delete prompt error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'AI 服务连接失败',
      };
    }
  }
}

/**
 * Prompt 模板类型
 */
interface PromptTemplate {
  id: string;
  name: string;
  template: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt?: string;
}

// 单例导出
export const aiService = new AIService();
