/**
 * DeepSeek Client
 * HTTP client for DeepSeek API (OpenAI compatible)
 */

import https from 'https';
import type { DeepSeekConfig, GenerateOptions } from '../types/index.js';

// OpenAI 兼容接口类型
interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionRequest {
  model: string;
  messages: ChatCompletionMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: ChatCompletionMessage;
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// 默认配置
const DEFAULT_CONFIG: DeepSeekConfig = {
  apiKey: '',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  timeout: 120000,
};

let currentConfig: DeepSeekConfig = { ...DEFAULT_CONFIG };

/**
 * 更新 DeepSeek 配置
 */
export function updateDeepSeekConfig(config: Partial<DeepSeekConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}

/**
 * 获取当前配置
 */
export function getDeepSeekConfig(): DeepSeekConfig {
  return { ...currentConfig };
}

/**
 * 检查 DeepSeek 是否已配置
 */
export function isDeepSeekConfigured(): boolean {
  return !!currentConfig.apiKey;
}

/**
 * 使用 DeepSeek 生成文本
 */
export async function deepseekGenerate(prompt: string, options: GenerateOptions = {}): Promise<string> {
  if (!currentConfig.apiKey) {
    throw new Error('DeepSeek API Key 未配置');
  }

  const baseUrl = currentConfig.baseUrl || 'https://api.deepseek.com';
  const url = new URL('/v1/chat/completions', baseUrl);
  const timeout = options.timeout || currentConfig.timeout || 120000;

  const requestBody: ChatCompletionRequest = {
    model: options.model || currentConfig.model,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4096,
    stream: false,
  };

  const requestBodyStr = JSON.stringify(requestBody);

  return new Promise((resolve, reject) => {
    const requestOptions: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentConfig.apiKey}`,
        'Content-Length': Buffer.byteLength(requestBodyStr),
      },
      timeout,
    };

    const req = https.request(requestOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            const errorData = JSON.parse(body);
            reject(new Error(`DeepSeek API error: ${res.statusCode} - ${errorData.error?.message || body}`));
            return;
          }

          const data: ChatCompletionResponse = JSON.parse(body);
          const content = data.choices?.[0]?.message?.content || '';
          resolve(content);
        } catch (e) {
          reject(new Error(`Failed to parse DeepSeek response: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('DeepSeek request timeout'));
    });

    req.write(requestBodyStr);
    req.end();
  });
}

/**
 * 测试 DeepSeek 连接
 */
export async function testDeepSeekConnection(): Promise<{ success: boolean; message: string; latency?: number }> {
  if (!currentConfig.apiKey) {
    return {
      success: false,
      message: 'DeepSeek API Key 未配置',
    };
  }

  const startTime = Date.now();

  try {
    // 测试简单生成
    const testPrompt = 'Hello';
    await deepseekGenerate(testPrompt, { maxTokens: 10, timeout: 30000 });

    const latency = Date.now() - startTime;
    return {
      success: true,
      message: `连接成功，模型: ${currentConfig.model}`,
      latency,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '连接失败',
    };
  }
}

/**
 * 获取可用模型列表
 */
export function getDeepSeekModels(): string[] {
  return ['deepseek-chat', 'deepseek-coder'];
}
