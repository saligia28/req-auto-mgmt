import { contextBridge, ipcRenderer } from 'electron';

// 暴露给渲染进程的API
contextBridge.exposeInMainWorld('electronAPI', {
  // 应用相关
  getPath: (name: string) => ipcRenderer.invoke('app:getPath', name),
  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  // 平台信息
  platform: process.platform,

  // 事件监听
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) =>
      callback(...args);
    ipcRenderer.on(channel, subscription);
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },

  // 发送消息
  send: (channel: string, ...args: unknown[]) => {
    ipcRenderer.send(channel, ...args);
  },

  // 调用并等待结果
  invoke: (channel: string, ...args: unknown[]) => {
    return ipcRenderer.invoke(channel, ...args);
  },

  // ==================== 设置相关 ====================
  settings: {
    getAll: () => ipcRenderer.invoke('settings:getAll'),
    update: (updates: unknown) => ipcRenderer.invoke('settings:update', updates),
    getTapdConfig: () => ipcRenderer.invoke('settings:getTapdConfig'),
    updateTapdConfig: (config: unknown) => ipcRenderer.invoke('settings:updateTapdConfig', config),
    getTheme: () => ipcRenderer.invoke('settings:getTheme'),
    setTheme: (theme: string) => ipcRenderer.invoke('settings:setTheme', theme),
    getProjects: () => ipcRenderer.invoke('settings:getProjects'),
    addProject: (project: unknown) => ipcRenderer.invoke('settings:addProject', project),
    updateProject: (id: string, updates: unknown) => ipcRenderer.invoke('settings:updateProject', id, updates),
    removeProject: (id: string) => ipcRenderer.invoke('settings:removeProject', id),
  },

  // ==================== TAPD 相关 ====================
  tapd: {
    isConfigured: () => ipcRenderer.invoke('tapd:isConfigured'),
    testConnection: () => ipcRenderer.invoke('tapd:testConnection'),
    getIterations: () => ipcRenderer.invoke('tapd:getIterations'),
    getCurrentIteration: () => ipcRenderer.invoke('tapd:getCurrentIteration'),
    getStories: (options?: unknown) => ipcRenderer.invoke('tapd:getStories', options),
    getStory: (id: string) => ipcRenderer.invoke('tapd:getStory', id),
  },

  // ==================== 文件相关 ====================
  file: {
    create: (story: unknown, directory: string) => ipcRenderer.invoke('file:create', story, directory),
    createBatch: (stories: unknown[], directory: string) => ipcRenderer.invoke('file:createBatch', stories, directory),
    list: (directory: string) => ipcRenderer.invoke('file:list', directory),
    read: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
    save: (filePath: string, content: string) => ipcRenderer.invoke('file:save', filePath, content),
    delete: (filePath: string) => ipcRenderer.invoke('file:delete', filePath),
    exists: (filePath: string) => ipcRenderer.invoke('file:exists', filePath),
    getStoryPath: (directory: string, storyId: string) => ipcRenderer.invoke('file:getStoryPath', directory, storyId),
  },

  // ==================== AI 相关 ====================
  ai: {
    analyze: (content: string) => ipcRenderer.invoke('ai:analyze', content),
    testConnection: () => ipcRenderer.invoke('ai:testConnection'),
    updateConfig: (config: unknown) => ipcRenderer.invoke('ai:updateConfig', config),
    getConfig: () => ipcRenderer.invoke('ai:getConfig'),
    getStatus: () => ipcRenderer.invoke('ai:getStatus'),
    getModels: () => ipcRenderer.invoke('ai:getModels'),
    // Prompt 管理
    getPrompts: () => ipcRenderer.invoke('ai:getPrompts'),
    createPrompt: (prompt: { name: string; template: string }) => ipcRenderer.invoke('ai:createPrompt', prompt),
    updatePrompt: (id: string, updates: { name?: string; template?: string }) => ipcRenderer.invoke('ai:updatePrompt', id, updates),
    deletePrompt: (id: string) => ipcRenderer.invoke('ai:deletePrompt', id),
  },

  // ==================== 对话框相关 ====================
  dialog: {
    selectDirectory: (options?: { title?: string; defaultPath?: string }) =>
      ipcRenderer.invoke('dialog:selectDirectory', options),
    selectFile: (options?: { title?: string; defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) =>
      ipcRenderer.invoke('dialog:selectFile', options),
  },

  // ==================== Shell 相关 ====================
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  },

  // ==================== 存储管理相关 ====================
  storage: {
    getStats: () => ipcRenderer.invoke('storage:getStats'),
    getCleanableItems: () => ipcRenderer.invoke('storage:getCleanableItems'),
    cleanup: (options: { type: string; olderThanDays?: number; keepDefaults?: boolean }) =>
      ipcRenderer.invoke('storage:cleanup', options),
    getDataDir: () => ipcRenderer.invoke('storage:getDataDir'),
  },

  // ==================== 终端相关 ====================
  terminal: {
    createSession: (request: {
      requirementId?: string;
      projectPath?: string;
      aiTool?: 'claude' | 'codex';
      command?: string;
      initialInput?: string;
      cwd: string;
    }) => ipcRenderer.invoke('terminal:createSession', request),
    getSessions: () => ipcRenderer.invoke('terminal:getSessions'),
    getSession: (sessionId: string) => ipcRenderer.invoke('terminal:getSession', sessionId),
    getOutput: (sessionId: string) => ipcRenderer.invoke('terminal:getOutput', sessionId),
    write: (sessionId: string, data: string) => ipcRenderer.invoke('terminal:write', sessionId, data),
    resize: (sessionId: string, cols: number, rows: number) => ipcRenderer.invoke('terminal:resize', sessionId, cols, rows),
    kill: (sessionId: string) => ipcRenderer.invoke('terminal:kill', sessionId),
    remove: (sessionId: string) => ipcRenderer.invoke('terminal:remove', sessionId),
    getActiveCount: () => ipcRenderer.invoke('terminal:getActiveCount'),
    canCreate: () => ipcRenderer.invoke('terminal:canCreate'),
    onOutput: (callback: (data: { sessionId: string; data: string }) => void) => {
      const subscription = (_event: Electron.IpcRendererEvent, data: { sessionId: string; data: string }) => callback(data);
      ipcRenderer.on('terminal:output', subscription);
      return () => ipcRenderer.removeListener('terminal:output', subscription);
    },
    onExit: (callback: (data: { sessionId: string; exitCode: number }) => void) => {
      const subscription = (_event: Electron.IpcRendererEvent, data: { sessionId: string; exitCode: number }) => callback(data);
      ipcRenderer.on('terminal:exit', subscription);
      return () => ipcRenderer.removeListener('terminal:exit', subscription);
    },
    getTools: () => ipcRenderer.invoke('terminal:getTools'),
  },
});

// 类型声明
interface PromptTemplate {
  id: string;
  name: string;
  template: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt?: string;
}

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
        analyze: (content: string) => Promise<{
          success: boolean;
          result?: {
            summary: string;
            testCases: string[];
            analyzedAt: string;
            model: string;
            provider: string;
          };
          error?: string;
        }>;
        testConnection: () => Promise<{ success: boolean; message?: string; latency?: number; error?: string }>;
        updateConfig: (config: unknown) => Promise<{ success: boolean; error?: string }>;
        getConfig: () => Promise<{ success: boolean; config?: unknown; error?: string }>;
        getStatus: () => Promise<{ success: boolean; status?: { provider: string; available: boolean; model: string }; error?: string }>;
        getModels: () => Promise<{ success: boolean; models?: { provider: string; models: string[] }[]; error?: string }>;
        // Prompt 管理
        getPrompts: () => Promise<{ success: boolean; prompts?: PromptTemplate[]; error?: string }>;
        createPrompt: (prompt: { name: string; template: string }) => Promise<{ success: boolean; prompt?: PromptTemplate; error?: string }>;
        updatePrompt: (id: string, updates: { name?: string; template?: string }) => Promise<{ success: boolean; prompt?: PromptTemplate; error?: string }>;
        deletePrompt: (id: string) => Promise<{ success: boolean; error?: string }>;
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
        }) => Promise<{
          id: string;
          requirementId?: string;
          projectPath?: string;
          aiTool?: 'claude' | 'codex';
          status: 'running' | 'completed' | 'failed';
          command?: string;
          cwd: string;
          createdAt: number;
        } | null>;
        getSessions: () => Promise<Array<{
          id: string;
          status: 'running' | 'completed' | 'failed';
          cwd: string;
          createdAt: number;
        }>>;
        getSession: (sessionId: string) => Promise<{
          id: string;
          status: 'running' | 'completed' | 'failed';
          cwd: string;
          createdAt: number;
        } | null>;
        getOutput: (sessionId: string) => Promise<string>;
        write: (sessionId: string, data: string) => Promise<boolean>;
        resize: (sessionId: string, cols: number, rows: number) => Promise<boolean>;
        kill: (sessionId: string) => Promise<boolean>;
        remove: (sessionId: string) => Promise<boolean>;
        getActiveCount: () => Promise<number>;
        canCreate: () => Promise<boolean>;
        onOutput: (callback: (data: { sessionId: string; data: string }) => void) => () => void;
        onExit: (callback: (data: { sessionId: string; exitCode: number }) => void) => () => void;
      };
    };
  }
}
