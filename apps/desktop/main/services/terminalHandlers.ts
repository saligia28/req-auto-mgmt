/**
 * Terminal IPC Handlers
 * 处理终端相关的 IPC 调用
 */

import { ipcMain } from 'electron';
import { ptyManager, CreateSessionRequest } from './ptyManager';

// AI 工具配置
const AI_TOOLS = [
  {
    id: 'claude',
    name: 'Claude Code',
    command: 'claude',
    template: '',
    description: '进入 Claude Code 交互模式',
  },
  {
    id: 'codex',
    name: 'Codex CLI',
    command: 'codex',
    template: '',
    description: '进入 Codex CLI 交互模式',
  },
];

export function registerTerminalHandlers(): void {
  // 创建会话
  ipcMain.handle('terminal:createSession', async (_, request: CreateSessionRequest) => {
    const session = ptyManager.createSession(request);
    return session;
  });

  // 获取所有会话
  ipcMain.handle('terminal:getSessions', async () => {
    return ptyManager.getAllSessions();
  });

  // 获取单个会话
  ipcMain.handle('terminal:getSession', async (_, sessionId: string) => {
    return ptyManager.getSession(sessionId);
  });

  // 获取会话输出
  ipcMain.handle('terminal:getOutput', async (_, sessionId: string) => {
    return ptyManager.getSessionOutput(sessionId);
  });

  // 向会话写入数据
  ipcMain.handle('terminal:write', async (_, sessionId: string, data: string) => {
    return ptyManager.writeToSession(sessionId, data);
  });

  // 调整终端大小
  ipcMain.handle('terminal:resize', async (_, sessionId: string, cols: number, rows: number) => {
    return ptyManager.resizeSession(sessionId, cols, rows);
  });

  // 终止会话
  ipcMain.handle('terminal:kill', async (_, sessionId: string) => {
    return ptyManager.killSession(sessionId);
  });

  // 删除会话
  ipcMain.handle('terminal:remove', async (_, sessionId: string) => {
    return ptyManager.removeSession(sessionId);
  });

  // 获取活跃会话数
  ipcMain.handle('terminal:getActiveCount', async () => {
    return ptyManager.getActiveSessionCount();
  });

  // 检查是否可以创建新会话
  ipcMain.handle('terminal:canCreate', async () => {
    return ptyManager.canCreateSession();
  });

  // 获取可用的 AI 工具
  ipcMain.handle('terminal:getTools', async () => {
    return { success: true, tools: AI_TOOLS };
  });

  console.log('[Terminal IPC] Handlers registered');
}

export function shutdownTerminal(): void {
  ptyManager.shutdown();
}
