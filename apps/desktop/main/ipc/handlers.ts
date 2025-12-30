/**
 * IPC Handlers
 * Registers all IPC handlers for main process
 */

import { ipcMain, dialog, BrowserWindow, shell } from 'electron';
import { tapdService } from '../services/tapdService';
import { settingsManager } from '../services/settingsManager';
import { fileService } from '../services/fileService';
import { aiService } from '../services/aiService';
import { storageCleanupManager, CleanupOptions } from '../services/storageCleanupManager';

/**
 * 注册所有 IPC 处理器
 */
export function registerIpcHandlers(): void {
  // ==================== 设置相关 ====================

  // 获取所有设置
  ipcMain.handle('settings:getAll', () => {
    return settingsManager.getAll();
  });

  // 更新设置
  ipcMain.handle('settings:update', (_, updates) => {
    settingsManager.update(updates);
    // 如果更新了 TAPD 配置，同步到 TAPD 服务
    if (updates.tapd) {
      tapdService.setConfig(settingsManager.getTapdConfig());
    }
    return { success: true };
  });

  // 获取 TAPD 配置
  ipcMain.handle('settings:getTapdConfig', () => {
    return settingsManager.getTapdConfig();
  });

  // 更新 TAPD 配置
  ipcMain.handle('settings:updateTapdConfig', (_, config) => {
    settingsManager.updateTapdConfig(config);
    tapdService.setConfig(settingsManager.getTapdConfig());
    return { success: true };
  });

  // 获取/设置主题
  ipcMain.handle('settings:getTheme', () => {
    return settingsManager.getTheme();
  });

  ipcMain.handle('settings:setTheme', (_, theme) => {
    settingsManager.setTheme(theme);
    return { success: true };
  });

  // 项目管理
  ipcMain.handle('settings:getProjects', () => {
    return settingsManager.getProjects();
  });

  ipcMain.handle('settings:addProject', (_, project) => {
    settingsManager.addProject(project);
    return { success: true };
  });

  ipcMain.handle('settings:updateProject', (_, id, updates) => {
    settingsManager.updateProject(id, updates);
    return { success: true };
  });

  ipcMain.handle('settings:removeProject', (_, id) => {
    settingsManager.removeProject(id);
    return { success: true };
  });

  // ==================== TAPD 相关 ====================

  // 检查 TAPD 是否已配置
  ipcMain.handle('tapd:isConfigured', () => {
    return tapdService.isConfigured();
  });

  // 获取迭代列表
  ipcMain.handle('tapd:getIterations', async () => {
    try {
      const iterations = await tapdService.getIterations();
      return { success: true, data: iterations };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  // 获取当前迭代
  ipcMain.handle('tapd:getCurrentIteration', async () => {
    try {
      const iteration = await tapdService.getCurrentIteration();
      return { success: true, data: iteration };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  // 获取需求列表
  ipcMain.handle('tapd:getStories', async (_, options) => {
    try {
      const stories = await tapdService.getStories(options);
      return { success: true, data: stories };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  // 获取需求详情
  ipcMain.handle('tapd:getStory', async (_, id) => {
    try {
      const story = await tapdService.getStory(id);
      if (!story) {
        return { success: false, error: 'Story not found' };
      }
      return { success: true, data: story };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  // 测试 TAPD 连接
  ipcMain.handle('tapd:testConnection', async () => {
    try {
      if (!tapdService.isConfigured()) {
        return { success: false, error: 'TAPD not configured' };
      }
      await tapdService.getIterations();
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Connection failed' };
    }
  });

  // ==================== 文件相关 ====================

  // 创建单个需求文件
  ipcMain.handle('file:create', async (_, story, directory) => {
    try {
      const result = await fileService.createFile({ story, directory });
      return result;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  // 批量创建需求文件
  ipcMain.handle('file:createBatch', async (_, stories, directory) => {
    try {
      const result = await fileService.createFiles(stories, directory);
      return result;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  // 获取文件列表
  ipcMain.handle('file:list', async (_, directory) => {
    try {
      const files = await fileService.listFiles(directory);
      return { success: true, data: files };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  // 读取文件内容
  ipcMain.handle('file:read', async (_, filePath) => {
    try {
      const result = await fileService.readFile(filePath);
      return result;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  // 保存文件内容
  ipcMain.handle('file:save', async (_, filePath, content) => {
    try {
      const result = await fileService.saveFile(filePath, content);
      return result;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  // 删除文件
  ipcMain.handle('file:delete', async (_, filePath) => {
    try {
      const result = await fileService.deleteFile(filePath);
      return result;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  // 检查文件是否存在
  ipcMain.handle('file:exists', async (_, filePath) => {
    try {
      const exists = fileService.fileExists(filePath);
      return { success: true, exists };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  // 获取需求文件路径
  ipcMain.handle('file:getStoryPath', async (_, directory, storyId) => {
    try {
      const filePath = fileService.getStoryFilePath(directory, storyId);
      return { success: true, path: filePath };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  // ==================== AI 相关 ====================

  // AI 分析需求
  ipcMain.handle('ai:analyze', async (_, content: string) => {
    try {
      const result = await aiService.analyze(content);
      return result;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  // 测试 AI 连接
  ipcMain.handle('ai:testConnection', async () => {
    try {
      const result = await aiService.testConnection();
      return result;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  // 更新 AI 配置
  ipcMain.handle('ai:updateConfig', async (_, config) => {
    try {
      const result = await aiService.updateConfig(config);
      return result;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  // 获取 AI 配置
  ipcMain.handle('ai:getConfig', async () => {
    try {
      const result = await aiService.getConfig();
      return result;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  // 获取 AI 服务状态
  ipcMain.handle('ai:getStatus', async () => {
    try {
      const result = await aiService.getStatus();
      return result;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  // 获取可用模型列表
  ipcMain.handle('ai:getModels', async () => {
    try {
      const result = await aiService.getModels();
      return result;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  // 获取所有 Prompt 模板
  ipcMain.handle('ai:getPrompts', async () => {
    try {
      const result = await aiService.getPrompts();
      return result;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  // 创建 Prompt 模板
  ipcMain.handle('ai:createPrompt', async (_, prompt: { name: string; template: string }) => {
    try {
      const result = await aiService.createPrompt(prompt);
      return result;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  // 更新 Prompt 模板
  ipcMain.handle('ai:updatePrompt', async (_, id: string, updates: { name?: string; template?: string }) => {
    try {
      const result = await aiService.updatePrompt(id, updates);
      return result;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  // 删除 Prompt 模板
  ipcMain.handle('ai:deletePrompt', async (_, id: string) => {
    try {
      const result = await aiService.deletePrompt(id);
      return result;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  // ==================== 对话框相关 ====================

  // 选择目录
  ipcMain.handle('dialog:selectDirectory', async (_, options?: { title?: string; defaultPath?: string }) => {
    try {
      const mainWindow = BrowserWindow.getFocusedWindow();
      const result = await dialog.showOpenDialog(mainWindow!, {
        title: options?.title || '选择目录',
        defaultPath: options?.defaultPath,
        properties: ['openDirectory', 'createDirectory'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      return { success: true, path: result.filePaths[0] };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  // 选择文件
  ipcMain.handle('dialog:selectFile', async (_, options?: {
    title?: string;
    defaultPath?: string;
    filters?: { name: string; extensions: string[] }[];
  }) => {
    try {
      const mainWindow = BrowserWindow.getFocusedWindow();
      const result = await dialog.showOpenDialog(mainWindow!, {
        title: options?.title || '选择文件',
        defaultPath: options?.defaultPath,
        filters: options?.filters,
        properties: ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      return { success: true, path: result.filePaths[0] };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  // ==================== Shell 相关 ====================

  // 在系统浏览器中打开外部链接
  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  // ==================== 存储管理相关 ====================

  // 获取存储统计信息
  ipcMain.handle('storage:getStats', async () => {
    try {
      const stats = await storageCleanupManager.getStats();
      return { success: true, data: stats };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  // 获取可清理项目列表
  ipcMain.handle('storage:getCleanableItems', async () => {
    try {
      const items = await storageCleanupManager.getCleanableItems();
      return { success: true, data: items };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  // 执行清理
  ipcMain.handle('storage:cleanup', async (_, options: CleanupOptions) => {
    try {
      const result = await storageCleanupManager.cleanup(options);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  // 获取数据目录路径
  ipcMain.handle('storage:getDataDir', () => {
    return { success: true, path: storageCleanupManager.getDataDir() };
  });

  console.log('[IPC] All handlers registered');
}

/**
 * 初始化服务
 */
export function initializeServices(): void {
  // 初始化设置管理器
  settingsManager.init();

  // 初始化存储清理管理器
  storageCleanupManager.init();

  // 从设置中加载 TAPD 配置
  const tapdConfig = settingsManager.getTapdConfig();
  if (tapdConfig.workspaceId) {
    tapdService.setConfig(tapdConfig);
  }

  console.log('[Services] Initialized');
}
