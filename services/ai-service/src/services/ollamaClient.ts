/**
 * Ollama Client
 * HTTP client for Ollama LLM API
 */

import http from 'http';
import https from 'https';
import type { OllamaConfig, GenerateOptions } from '../types/index.js';

export interface OllamaGenerateResponse {
  response: string;
  done: boolean;
  context?: number[];
  totalDuration?: number;
  loadDuration?: number;
  promptEvalDuration?: number;
  evalDuration?: number;
}

// 默认配置
const DEFAULT_CONFIG: OllamaConfig = {
  baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  model: process.env.OLLAMA_MODEL || 'gpt-oss:20b',
  timeout: Number(process.env.OLLAMA_TIMEOUT || 120000),
};

let currentConfig: OllamaConfig = { ...DEFAULT_CONFIG };

/**
 * 更新 Ollama 配置
 */
export function updateOllamaConfig(config: Partial<OllamaConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}

/**
 * 获取当前配置
 */
export function getOllamaConfig(): OllamaConfig {
  return { ...currentConfig };
}

/**
 * 检查 Ollama 服务是否可用
 */
export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const url = new URL('/api/tags', currentConfig.baseUrl);
    return new Promise((resolve) => {
      const isHttps = url.protocol === 'https:';
      const lib = isHttps ? https : http;

      const req = lib.get(url.toString(), { timeout: 5000 }, (res) => {
        resolve(res.statusCode === 200);
      });

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });
  } catch {
    return false;
  }
}

/**
 * 获取可用模型列表
 */
export async function getOllamaModels(): Promise<string[]> {
  const url = new URL('/api/tags', currentConfig.baseUrl);

  return new Promise((resolve, reject) => {
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const req = lib.get(url.toString(), { timeout: 10000 }, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            reject(new Error(`Ollama API error: ${res.statusCode}`));
            return;
          }
          const data = JSON.parse(body);
          const models = data.models?.map((m: any) => m.name) || [];
          resolve(models);
        } catch (e) {
          reject(new Error('Failed to parse models list'));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * 使用 Ollama 生成文本
 */
export async function ollamaGenerate(
  prompt: string,
  options: GenerateOptions = {}
): Promise<string> {
  const url = new URL('/api/generate', currentConfig.baseUrl);
  const timeout = options.timeout || currentConfig.timeout || 120000;

  const requestBody = JSON.stringify({
    model: options.model || currentConfig.model,
    prompt,
    stream: false,
    options: {
      temperature: options.temperature ?? 0.7,
      num_predict: options.maxTokens ?? 4096,
    },
  });

  return new Promise((resolve, reject) => {
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const requestOptions: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
      },
      timeout,
    };

    const req = lib.request(requestOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            reject(new Error(`Ollama API error: ${res.statusCode} - ${body}`));
            return;
          }

          const data: OllamaGenerateResponse = JSON.parse(body);
          resolve(data.response || '');
        } catch (e) {
          reject(new Error(`Failed to parse Ollama response: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Ollama request timeout'));
    });

    req.write(requestBody);
    req.end();
  });
}

/**
 * 测试 Ollama 连接
 */
export async function testOllamaConnection(): Promise<{
  success: boolean;
  message: string;
  latency?: number;
}> {
  const startTime = Date.now();

  try {
    const available = await isOllamaAvailable();
    if (!available) {
      return {
        success: false,
        message: `无法连接到 Ollama 服务 (${currentConfig.baseUrl})`,
      };
    }

    // 测试简单生成
    const testPrompt = 'Hello';
    await ollamaGenerate(testPrompt, { maxTokens: 10, timeout: 30000 });

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
