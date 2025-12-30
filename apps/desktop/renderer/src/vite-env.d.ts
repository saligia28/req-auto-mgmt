/// <reference types="vite/client" />

// Electron API 类型声明
declare global {
  interface Window {
    electronAPI: {
      getPath: (name: string) => Promise<string>;
      getVersion: () => Promise<string>;
      platform: NodeJS.Platform;
      on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
      send: (channel: string, ...args: unknown[]) => void;
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
      settings: {
        getAll: () => Promise<unknown>;
        update: (updates: unknown) => Promise<{ success: boolean }>;
        getTapdConfig: () => Promise<unknown>;
        updateTapdConfig: (config: unknown) => Promise<{ success: boolean }>;
        getTheme: () => Promise<string>;
        setTheme: (theme: string) => Promise<{ success: boolean }>;
        getProjects: () => Promise<unknown[]>;
        addProject: (project: unknown) => Promise<{ success: boolean }>;
        updateProject: (id: string, updates: unknown) => Promise<{ success: boolean }>;
        removeProject: (id: string) => Promise<{ success: boolean }>;
      };
      tapd: {
        isConfigured: () => Promise<boolean>;
        testConnection: () => Promise<{ success: boolean; error?: string }>;
        getIterations: () => Promise<{ success: boolean; data?: unknown[]; error?: string }>;
        getCurrentIteration: () => Promise<{ success: boolean; data?: unknown; error?: string }>;
        getStories: (options?: unknown) => Promise<{ success: boolean; data?: unknown[]; error?: string }>;
        getStory: (id: string) => Promise<{ success: boolean; data?: unknown; error?: string }>;
      };
      file: {
        create: (story: unknown, directory: string) => Promise<{ success: boolean; path?: string; error?: string }>;
        createBatch: (stories: unknown[], directory: string) => Promise<{ success: boolean; created: string[]; skipped: string[]; errors: { id: string; error: string }[] }>;
        list: (directory: string) => Promise<{ success: boolean; data?: unknown[]; error?: string }>;
        read: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
        save: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
        delete: (filePath: string) => Promise<{ success: boolean; error?: string }>;
        exists: (filePath: string) => Promise<{ success: boolean; exists?: boolean; error?: string }>;
        getStoryPath: (directory: string, storyId: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      };
      ai: {
        getConfig: () => Promise<{ success: boolean; config?: AIModelConfigRaw; error?: string }>;
        updateConfig: (config: AIModelConfigRaw) => Promise<{ success: boolean; error?: string }>;
        testConnection: () => Promise<{ success: boolean; message?: string; latency?: number; error?: string }>;
        analyze: (content: string, promptTemplate?: string) => Promise<{ success: boolean; result?: AnalysisResultRaw; error?: string }>;
        getPrompts: () => Promise<{ success: boolean; prompts?: PromptTemplateRaw[]; error?: string }>;
        createPrompt: (prompt: { name: string; template: string }) => Promise<{ success: boolean; prompt?: PromptTemplateRaw; error?: string }>;
        updatePrompt: (id: string, updates: { name?: string; template?: string }) => Promise<{ success: boolean; prompt?: PromptTemplateRaw; error?: string }>;
        deletePrompt: (id: string) => Promise<{ success: boolean; error?: string }>;
        getModels: () => Promise<{ success: boolean; models?: { provider: string; models: string[] }[]; error?: string }>;
        getStatus: () => Promise<{ success: boolean; status?: { provider: string; available: boolean; model: string }; error?: string }>;
      };
      dialog: {
        selectDirectory: (options?: { title?: string; defaultPath?: string }) => Promise<{ success: boolean; path?: string; canceled?: boolean; error?: string }>;
        selectFile: (options?: { title?: string; defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => Promise<{ success: boolean; path?: string; canceled?: boolean; error?: string }>;
      };
      shell: {
        openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
      };
      storage: {
        getStats: () => Promise<{
          success: boolean;
          data?: {
            prompts: { count: number; size: number; path: string };
            logs: { count: number; size: number; path: string };
            cache: { count: number; size: number; path: string };
            config: { count: number; size: number; path: string };
            total: { count: number; size: number };
          };
          error?: string;
        }>;
        getCleanableItems: () => Promise<{
          success: boolean;
          data?: Array<{
            type: string;
            name: string;
            description: string;
            count: number;
            size: number;
            canClean: boolean;
          }>;
          error?: string;
        }>;
        cleanup: (options: { type: string; olderThanDays?: number; keepDefaults?: boolean }) => Promise<{
          success: boolean;
          data?: {
            success: boolean;
            type: string;
            deletedCount: number;
            freedBytes: number;
            errors?: string[];
          };
          error?: string;
        }>;
        getDataDir: () => Promise<{ success: boolean; path?: string; error?: string }>;
      };
      terminal: {
        createSession: (request: {
          requirementId?: string;
          projectPath?: string;
          aiTool?: 'claude' | 'codex';
          command?: string;
          initialInput?: string;
          cwd: string;
        }) => Promise<TerminalSessionRaw | null>;
        getSessions: () => Promise<TerminalSessionRaw[]>;
        getSession: (sessionId: string) => Promise<TerminalSessionRaw | null>;
        getOutput: (sessionId: string) => Promise<string>;
        write: (sessionId: string, data: string) => Promise<boolean>;
        resize: (sessionId: string, cols: number, rows: number) => Promise<boolean>;
        kill: (sessionId: string) => Promise<boolean>;
        remove: (sessionId: string) => Promise<boolean>;
        getActiveCount: () => Promise<number>;
        canCreate: () => Promise<boolean>;
        onOutput: (callback: (data: { sessionId: string; data: string }) => void) => () => void;
        onExit: (callback: (data: { sessionId: string; exitCode: number }) => void) => () => void;
        getTools: () => Promise<{ success: boolean; tools?: AIToolRaw[]; error?: string }>;
      };
    };
  }
}

// AI 相关类型
interface AIModelConfigRaw {
  provider: 'ollama' | 'deepseek';
  ollama?: {
    baseUrl: string;
    model: string;
    timeout?: number;
  };
  deepseek?: {
    apiKey: string;
    baseUrl?: string;
    model: 'deepseek-chat' | 'deepseek-coder' | 'deepseek-reasoner';
    timeout?: number;
  };
}

interface AnalysisResultRaw {
  summary: string;
  testCases: string[];
  analyzedAt: string;
  model: string;
  provider: 'ollama' | 'deepseek';
}

interface PromptTemplateRaw {
  id: string;
  name: string;
  template: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt?: string;
}

// Terminal 相关类型
interface TerminalSessionRaw {
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

interface CreateTerminalSessionRequest {
  cwd: string;
  aiTool: 'claude' | 'codex';
  requirementId?: string;
  customPrompt?: string;
}

interface AIToolRaw {
  id: string;
  name: string;
  command: string;
  description: string;
}

export {};
