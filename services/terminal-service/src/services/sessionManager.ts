/**
 * Session Manager
 * 管理终端会话的持久化和恢复
 */

import fs from 'fs';
import path from 'path';
import type { TerminalSession } from '../types/index.js';

// 日志目录
let logDir = './logs/terminal';

/**
 * 设置日志目录
 */
export function setLogDirectory(dir: string): void {
  logDir = dir;
  ensureLogDir();
}

/**
 * 确保日志目录存在
 */
function ensureLogDir(): void {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}

/**
 * 获取会话日志文件路径
 */
function getSessionLogPath(sessionId: string): string {
  ensureLogDir();
  return path.join(logDir, `session_${sessionId}.log`);
}

/**
 * 获取会话元数据文件路径
 */
function getSessionMetaPath(sessionId: string): string {
  ensureLogDir();
  return path.join(logDir, `session_${sessionId}.json`);
}

/**
 * 保存会话元数据
 */
export function saveSessionMeta(session: TerminalSession): void {
  try {
    const metaPath = getSessionMetaPath(session.id);
    fs.writeFileSync(metaPath, JSON.stringify(session, null, 2));
  } catch (error) {
    console.error(`[Session Manager] Failed to save session meta ${session.id}:`, error);
  }
}

/**
 * 加载会话元数据
 */
export function loadSessionMeta(sessionId: string): TerminalSession | null {
  try {
    const metaPath = getSessionMetaPath(sessionId);
    if (fs.existsSync(metaPath)) {
      const content = fs.readFileSync(metaPath, 'utf-8');
      return JSON.parse(content) as TerminalSession;
    }
  } catch (error) {
    console.error(`[Session Manager] Failed to load session meta ${sessionId}:`, error);
  }
  return null;
}

/**
 * 追加会话日志
 */
export function appendSessionLog(sessionId: string, data: string): void {
  try {
    const logPath = getSessionLogPath(sessionId);
    fs.appendFileSync(logPath, data);
  } catch (error) {
    console.error(`[Session Manager] Failed to append log ${sessionId}:`, error);
  }
}

/**
 * 读取会话日志
 */
export function readSessionLog(sessionId: string): string {
  try {
    const logPath = getSessionLogPath(sessionId);
    if (fs.existsSync(logPath)) {
      return fs.readFileSync(logPath, 'utf-8');
    }
  } catch (error) {
    console.error(`[Session Manager] Failed to read log ${sessionId}:`, error);
  }
  return '';
}

/**
 * 删除会话日志
 */
export function deleteSessionLog(sessionId: string): void {
  try {
    const logPath = getSessionLogPath(sessionId);
    const metaPath = getSessionMetaPath(sessionId);

    if (fs.existsSync(logPath)) {
      fs.unlinkSync(logPath);
    }
    if (fs.existsSync(metaPath)) {
      fs.unlinkSync(metaPath);
    }
  } catch (error) {
    console.error(`[Session Manager] Failed to delete log ${sessionId}:`, error);
  }
}

/**
 * 获取所有保存的会话
 */
export function getAllSavedSessions(): TerminalSession[] {
  try {
    ensureLogDir();
    const files = fs.readdirSync(logDir);
    const sessions: TerminalSession[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const sessionId = file.replace('session_', '').replace('.json', '');
        const session = loadSessionMeta(sessionId);
        if (session) {
          sessions.push(session);
        }
      }
    }

    return sessions.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error('[Session Manager] Failed to get saved sessions:', error);
    return [];
  }
}

/**
 * 清理过期的会话日志（保留最近7天）
 */
export function cleanupOldLogs(daysToKeep: number = 7): number {
  try {
    ensureLogDir();
    const files = fs.readdirSync(logDir);
    const cutoff = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
    let cleaned = 0;

    for (const file of files) {
      if (file.endsWith('.json')) {
        const sessionId = file.replace('session_', '').replace('.json', '');
        const session = loadSessionMeta(sessionId);

        if (session && session.createdAt < cutoff) {
          deleteSessionLog(sessionId);
          cleaned++;
        }
      }
    }

    return cleaned;
  } catch (error) {
    console.error('[Session Manager] Failed to cleanup old logs:', error);
    return 0;
  }
}
