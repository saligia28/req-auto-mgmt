/**
 * AI Service Types
 */

// AI 配置
export interface AIConfig {
  provider: 'ollama' | 'deepseek';
  ollama?: OllamaConfig;
  deepseek?: DeepSeekConfig;
}

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  timeout?: number;
}

export interface DeepSeekConfig {
  apiKey: string;
  baseUrl?: string;
  model: 'deepseek-chat' | 'deepseek-coder';
  timeout?: number;
}

// 生成选项
export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  model?: string;
}

// 分析请求
export interface AnalyzeRequest {
  content: string;
  promptTemplate?: string;
}

// 分析结果
export interface AnalyzeResponse {
  success: boolean;
  result?: AnalysisResult;
  error?: string;
}

export interface AnalysisResult {
  summary: string;
  testCases: string[];
  analyzedAt: string;
  model: string;
  provider: 'ollama' | 'deepseek';
}

// Prompt 模板
export interface PromptTemplate {
  id: string;
  name: string;
  template: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt?: string;
}

// 默认 Prompt 模板
export const DEFAULT_ANALYSIS_PROMPT = `请分析以下需求，输出：
1. 需求要点（3-5条核心功能点）
2. 测试用例建议（覆盖主要场景）

需求内容：
{content}

请按以下JSON格式输出（注意输出纯JSON，不要包含markdown代码块标记）：
{
  "summary": "需求要点的文本描述，使用换行分隔每个要点",
  "testCases": ["测试用例1", "测试用例2", ...]
}`;

// 模型测试结果
export interface ModelTestResult {
  success: boolean;
  message: string;
  latency?: number;
}
