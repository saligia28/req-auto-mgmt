/**
 * PTY Manager for Electron Main Process
 * 在主进程中管理伪终端
 */

import * as pty from 'node-pty';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { BrowserWindow } from 'electron';

export interface TerminalSession {
  id: string;
  requirementId?: string;
  projectPath?: string;
  aiTool?: 'claude' | 'codex';
  status: 'running' | 'completed' | 'failed';
  command?: string;
  cwd: string;
  createdAt: number;
  completedAt?: number;
  exitCode?: number;
}

export interface CreateSessionRequest {
  requirementId?: string;
  projectPath?: string;
  aiTool?: 'claude' | 'codex';
  command?: string;
  initialInput?: string;
  cwd: string;
}

interface PtyInstance {
  pty: pty.IPty;
  session: TerminalSession;
  outputBuffer: string[];
}

const MAX_PARALLEL_SESSIONS = 5;

class PtyManager extends EventEmitter {
  private instances: Map<string, PtyInstance> = new Map();
  private shell: string;

  constructor() {
    super();
    this.shell = process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/zsh';
  }

  getActiveSessionCount(): number {
    let count = 0;
    for (const instance of this.instances.values()) {
      if (instance.session.status === 'running') {
        count++;
      }
    }
    return count;
  }

  canCreateSession(): boolean {
    return this.getActiveSessionCount() < MAX_PARALLEL_SESSIONS;
  }

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

      ptyProcess.onData((data) => {
        instance.outputBuffer.push(data);
        if (instance.outputBuffer.length > 10000) {
          instance.outputBuffer.shift();
        }
        this.emit('output', sessionId, data);
        this.broadcastToRenderers('terminal:output', { sessionId, data });
      });

      ptyProcess.onExit(({ exitCode }) => {
        session.status = exitCode === 0 ? 'completed' : 'failed';
        session.completedAt = Date.now();
        session.exitCode = exitCode;
        this.emit('exit', sessionId, exitCode);
        this.broadcastToRenderers('terminal:exit', { sessionId, exitCode });
      });

      this.instances.set(sessionId, instance);

      setTimeout(() => {
        if (request.command) {
          let fullCommand = request.command;
          if (request.initialInput) {
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

  private broadcastToRenderers(channel: string, data: unknown): void {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, data);
      }
    }
  }

  getSession(sessionId: string): TerminalSession | null {
    const instance = this.instances.get(sessionId);
    return instance?.session || null;
  }

  getAllSessions(): TerminalSession[] {
    return Array.from(this.instances.values()).map((i) => i.session);
  }

  getSessionOutput(sessionId: string): string {
    const instance = this.instances.get(sessionId);
    return instance?.outputBuffer.join('') || '';
  }

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

  removeSession(sessionId: string): boolean {
    const instance = this.instances.get(sessionId);
    if (!instance) {
      return false;
    }

    if (instance.session.status === 'running') {
      this.killSession(sessionId);
    }

    this.instances.delete(sessionId);
    console.log(`[PTY Manager] Session removed: ${sessionId}`);
    return true;
  }

  shutdown(): void {
    for (const [sessionId] of this.instances) {
      this.killSession(sessionId);
    }
    this.instances.clear();
    console.log('[PTY Manager] Shutdown complete');
  }
}

export const ptyManager = new PtyManager();
