// TAPD相关类型
export interface TapdIteration {
  id: string;
  name: string;
  status: string;
  startDate?: string;
  endDate?: string;
}

export interface TapdStory {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  owner: string;
  iteration?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface StorySummary {
  id: string;
  title: string;
  status?: string | null;
  owners: string[];
  frontend?: string | null;
  iteration?: string | null;
  updatedAt?: string | null;
  url?: string | null;
}

// 路径配置
export interface PathConfig {
  id: string;
  label: string;
  path: string;
}

// AI实现相关
export interface AIImplementRequest {
  terminalType: 'claude' | 'codex';
  workingDirectory: string;
  promptText: string;
  storyId: string;
  storyTitle: string;
}

export interface AIImplementResponse {
  success: boolean;
  message: string;
  sessionId?: string;
}

// 终端会话
export interface TerminalSession {
  id: string;
  requirementId?: string;
  projectId: string;
  aiTool: 'claude' | 'codex';
  status: 'running' | 'completed' | 'failed';
  command: string;
  cwd: string;
  createdAt: number;
}

// AI模型配置
export interface AIModelConfig {
  provider: 'ollama' | 'deepseek';
  ollama?: {
    baseUrl: string;
    model: string;
    timeout?: number;
  };
  deepseek?: {
    apiKey: string;
    baseUrl?: string;
    model: 'deepseek-chat' | 'deepseek-reasoner';
    timeout?: number;
  };
}

// AI分析结果
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

// 应用设置
export interface AppSettings {
  paths: {
    requirementsDir: string;
    projects: PathConfig[];
  };
  tapd: {
    apiBase: string;
    workspaceId: string;
    token?: string;
    username?: string;
    password?: string;
  };
  ai: AIModelConfig;
  notification: {
    enabled: boolean;
    webhookUrl: string;
  };
  theme: 'claude' | 'notion' | 'hacker';
}

// 导航类型
export type NavItem = 'requirements' | 'terminal' | 'settings';
