/**
 * AI Analysis Service
 * 统一的 AI 分析服务，支持 Ollama 和 DeepSeek
 */

import {
  ollamaGenerate,
  updateOllamaConfig,
  testOllamaConnection,
  isOllamaAvailable,
  getOllamaModels,
} from './ollamaClient.js';
import {
  deepseekGenerate,
  updateDeepSeekConfig,
  testDeepSeekConnection,
  isDeepSeekConfigured,
  getDeepSeekModels,
} from './deepseekClient.js';
import type { AIConfig, AnalyzeRequest, AnalysisResult, GenerateOptions } from '../types/index.js';
import { DEFAULT_ANALYSIS_PROMPT as defaultPrompt } from '../types/index.js';

// 当前 AI 配置
let currentConfig: AIConfig = {
  provider: 'ollama',
  ollama: {
    baseUrl: 'http://localhost:11434',
    model: 'gpt-oss:20b',
  },
};

/**
 * 更新 AI 配置
 */
export function updateAIConfig(config: Partial<AIConfig>): void {
  currentConfig = { ...currentConfig, ...config };

  // 同步更新各客户端配置
  if (config.ollama) {
    updateOllamaConfig(config.ollama);
  }
  if (config.deepseek) {
    updateDeepSeekConfig(config.deepseek);
  }
}

/**
 * 获取当前配置
 */
export function getAIConfig(): AIConfig {
  return { ...currentConfig };
}

/**
 * 使用当前配置的 AI 生成文本
 */
export async function generate(prompt: string, options: GenerateOptions = {}): Promise<string> {
  if (currentConfig.provider === 'deepseek') {
    return deepseekGenerate(prompt, options);
  }
  return ollamaGenerate(prompt, options);
}

/**
 * 解析 AI 返回的 JSON
 */
function parseAIResponse(response: string): { summary: string; testCases: string[] } {
  // 尝试提取 JSON
  let jsonStr = response;

  // 移除可能的 markdown 代码块标记
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  // 尝试找到 JSON 对象
  const jsonObjMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonObjMatch) {
    jsonStr = jsonObjMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      summary: parsed.summary || '',
      testCases: Array.isArray(parsed.testCases) ? parsed.testCases : [],
    };
  } catch {
    // 解析失败，将整个响应作为 summary
    return {
      summary: response,
      testCases: [],
    };
  }
}

/**
 * 分析需求
 */
export async function analyzeRequirement(request: AnalyzeRequest): Promise<AnalysisResult> {
  const promptTemplate = request.promptTemplate || defaultPrompt;
  const prompt = promptTemplate.replace('{content}', request.content);

  const startTime = Date.now();
  const response = await generate(prompt, { maxTokens: 4096 });
  const latency = Date.now() - startTime;

  console.log(`[AI Service] Analysis completed in ${latency}ms`);

  const { summary, testCases } = parseAIResponse(response);

  const config = getAIConfig();
  const model =
    config.provider === 'deepseek'
      ? config.deepseek?.model || 'deepseek-chat'
      : config.ollama?.model || 'gpt-oss:20b';

  return {
    summary,
    testCases,
    analyzedAt: new Date().toISOString(),
    model,
    provider: config.provider,
  };
}

/**
 * 测试当前配置的 AI 连接
 */
export async function testConnection(): Promise<{
  success: boolean;
  message: string;
  latency?: number;
}> {
  if (currentConfig.provider === 'deepseek') {
    return testDeepSeekConnection();
  }
  return testOllamaConnection();
}

/**
 * 获取可用模型列表
 */
export async function getAvailableModels(): Promise<{ provider: string; models: string[] }[]> {
  const result: { provider: string; models: string[] }[] = [];

  // Ollama 模型
  try {
    if (await isOllamaAvailable()) {
      const models = await getOllamaModels();
      result.push({ provider: 'ollama', models });
    }
  } catch (e) {
    console.warn('[AI Service] Failed to get Ollama models:', e);
  }

  // DeepSeek 模型
  if (isDeepSeekConfigured()) {
    result.push({ provider: 'deepseek', models: getDeepSeekModels() });
  }

  return result;
}

/**
 * 检查 AI 服务状态
 */
export async function checkStatus(): Promise<{
  provider: string;
  available: boolean;
  model: string;
}> {
  const config = getAIConfig();

  if (config.provider === 'deepseek') {
    const configured = isDeepSeekConfigured();
    return {
      provider: 'deepseek',
      available: configured,
      model: config.deepseek?.model || 'deepseek-chat',
    };
  }

  const available = await isOllamaAvailable();
  return {
    provider: 'ollama',
    available,
    model: config.ollama?.model || 'gpt-oss:20b',
  };
}
