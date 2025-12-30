/**
 * Terminal Service Types
 */

// 终端会话
export interface TerminalSession {
  id: string;
  requirementId?: string;
  projectPath: string;
  aiTool: 'claude' | 'codex';
  status: 'running' | 'completed' | 'failed';
  command: string;
  cwd: string;
  createdAt: number;
  completedAt?: number;
  exitCode?: number;
}

// 创建会话请求
export interface CreateSessionRequest {
  requirementId?: string;
  projectPath: string;
  aiTool: 'claude' | 'codex';
  command: string;
  cwd: string;
  initialInput?: string; // AI 工具启动后自动发送的初始输入
}

// 会话响应
export interface SessionResponse {
  success: boolean;
  session?: TerminalSession;
  error?: string;
}

// 终端输入请求
export interface TerminalInputRequest {
  data: string;
}

// 终端调整大小请求
export interface TerminalResizeRequest {
  cols: number;
  rows: number;
}

// WebSocket 消息类型
export type WSMessageType =
  | 'output'      // 终端输出
  | 'exit'        // 进程退出
  | 'error'       // 错误
  | 'resize'      // 调整大小
  | 'input';      // 输入

// WebSocket 消息
export interface WSMessage {
  type: WSMessageType;
  sessionId: string;
  data?: string;
  exitCode?: number;
  cols?: number;
  rows?: number;
}

// 企微通知配置
export interface NotificationConfig {
  enabled: boolean;
  webhookUrl: string;
}

// 通知消息
export interface NotificationMessage {
  msgtype: 'markdown';
  markdown: {
    content: string;
  };
}

// AI 工具配置
export interface AIToolConfig {
  id: 'claude' | 'codex';
  name: string;
  command: string;
  template: string;
  description?: string;
  enabled: boolean;
}

// 默认 AI 工具配置
export const DEFAULT_AI_TOOLS: AIToolConfig[] = [
  {
    id: 'claude',
    name: 'Claude Code',
    command: 'claude',
    template: '',
    description: '进入 Claude Code 交互模式',
    enabled: true,
  },
  {
    id: 'codex',
    name: 'Codex CLI',
    command: 'codex',
    template: '',
    description: '进入 Codex CLI 交互模式',
    enabled: true,
  },
];
