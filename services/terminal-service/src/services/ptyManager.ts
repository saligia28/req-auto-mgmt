/**
 * PTY Manager
 * 管理伪终端进程
 */

import * as pty from 'node-pty';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type { TerminalSession, CreateSessionRequest } from '../types/index.js';

// PTY 进程实例
interface PtyInstance {
  pty: pty.IPty;
  session: TerminalSession;
  outputBuffer: string[];
}

// 最大并行会话数
const MAX_PARALLEL_SESSIONS = 5;

class PtyManager extends EventEmitter {
  private instances: Map<string, PtyInstance> = new Map();
  private shell: string;

  constructor() {
    super();
    // 根据平台选择 shell
    this.shell = process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/zsh';
  }

  /**
   * 获取活跃会话数
   */
  getActiveSessionCount(): number {
    let count = 0;
    for (const instance of this.instances.values()) {
      if (instance.session.status === 'running') {
        count++;
      }
    }
    return count;
  }

  /**
   * 检查是否可以创建新会话
   */
  canCreateSession(): boolean {
    return this.getActiveSessionCount() < MAX_PARALLEL_SESSIONS;
  }

  /**
   * 创建新的 PTY 会话
   */
  createSession(request: CreateSessionRequest): TerminalSession | null {
    if (!this.canCreateSession()) {
      console.warn('[PTY Manager] Max parallel sessions reached');
      return null;
    }

    const sessionId = uuidv4();
    const session: TerminalSession = {
      id: sessionId,
      requirementId: request.requirementId,
      projectPath: request.projectPath,
      aiTool: request.aiTool,
      status: 'running',
      command: request.command,
      cwd: request.cwd,
      createdAt: Date.now(),
    };

    try {
      // 创建 PTY 进程
      const ptyProcess = pty.spawn(this.shell, [], {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd: request.cwd,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
        },
      });

      const instance: PtyInstance = {
        pty: ptyProcess,
        session,
        outputBuffer: [],
      };

      // 监听输出
      ptyProcess.onData((data) => {
        instance.outputBuffer.push(data);
        // 限制缓冲区大小
        if (instance.outputBuffer.length > 10000) {
          instance.outputBuffer.shift();
        }
        this.emit('output', sessionId, data);
      });

      // 监听退出
      ptyProcess.onExit(({ exitCode }) => {
        session.status = exitCode === 0 ? 'completed' : 'failed';
        session.completedAt = Date.now();
        session.exitCode = exitCode;
        this.emit('exit', sessionId, exitCode);
      });

      this.instances.set(sessionId, instance);

      // 延迟执行命令（等待 shell 初始化）
      setTimeout(() => {
        if (request.command) {
          // 构建完整命令：如果有 initialInput，作为 CLI 参数传入
          let fullCommand = request.command;
          if (request.initialInput) {
            // 转义单引号，与 frontend 项目保持一致
            const escapedMessage = request.initialInput.replace(/'/g, "'\\''");
            fullCommand = `${request.command} '${escapedMessage}'`;
          }
          ptyProcess.write(fullCommand + '\r');
          console.log(`[PTY Manager] Command started for session: ${sessionId}`);
        }
      }, 500);

      console.log(`[PTY Manager] Session created: ${sessionId}`);
      return session;
    } catch (error) {
      console.error('[PTY Manager] Failed to create session:', error);
      return null;
    }
  }

  /**
   * 获取会话
   */
  getSession(sessionId: string): TerminalSession | null {
    const instance = this.instances.get(sessionId);
    return instance?.session || null;
  }

  /**
   * 获取所有会话
   */
  getAllSessions(): TerminalSession[] {
    return Array.from(this.instances.values()).map((i) => i.session);
  }

  /**
   * 获取会话输出缓冲
   */
  getSessionOutput(sessionId: string): string {
    const instance = this.instances.get(sessionId);
    return instance?.outputBuffer.join('') || '';
  }

  /**
   * 向会话发送输入
   */
  writeToSession(sessionId: string, data: string): boolean {
    const instance = this.instances.get(sessionId);
    if (!instance || instance.session.status !== 'running') {
      return false;
    }

    try {
      instance.pty.write(data);
      return true;
    } catch (error) {
      console.error(`[PTY Manager] Failed to write to session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * 调整会话终端大小
   */
  resizeSession(sessionId: string, cols: number, rows: number): boolean {
    const instance = this.instances.get(sessionId);
    if (!instance || instance.session.status !== 'running') {
      return false;
    }

    try {
      instance.pty.resize(cols, rows);
      return true;
    } catch (error) {
      console.error(`[PTY Manager] Failed to resize session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * 终止会话
   */
  killSession(sessionId: string): boolean {
    const instance = this.instances.get(sessionId);
    if (!instance) {
      return false;
    }

    try {
      if (instance.session.status === 'running') {
        instance.pty.kill();
        instance.session.status = 'failed';
        instance.session.completedAt = Date.now();
      }
      return true;
    } catch (error) {
      console.error(`[PTY Manager] Failed to kill session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * 删除会话（从内存中移除）
   */
  removeSession(sessionId: string): boolean {
    const instance = this.instances.get(sessionId);
    if (!instance) {
      return false;
    }

    // 如果还在运行，先终止
    if (instance.session.status === 'running') {
      this.killSession(sessionId);
    }

    this.instances.delete(sessionId);
    console.log(`[PTY Manager] Session removed: ${sessionId}`);
    return true;
  }

  /**
   * 清理所有已完成的会话
   */
  cleanupCompletedSessions(): number {
    let cleaned = 0;
    for (const [sessionId, instance] of this.instances.entries()) {
      if (instance.session.status !== 'running') {
        this.instances.delete(sessionId);
        cleaned++;
      }
    }
    return cleaned;
  }

  /**
   * 关闭所有会话
   */
  shutdown(): void {
    for (const [sessionId] of this.instances) {
      this.killSession(sessionId);
    }
    this.instances.clear();
    console.log('[PTY Manager] Shutdown complete');
  }
}

// 导出单例
export const ptyManager = new PtyManager();
export { PtyManager };
