/**
 * Terminal Service Entry Point
 * Express + WebSocket server for terminal management
 */

import express, { Application } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import apiRoutes, { ptyManager, saveSessionMeta, notifyTaskCompleted } from './routes/index.js';
import { appendSessionLog, setLogDirectory, readSessionLog } from './services/sessionManager.js';
import type { WSMessage } from './types/index.js';

const PORT = process.env.TERMINAL_SERVICE_PORT || 3403;

// 创建 Express 应用
const app: Application = express();

// 中间件
app.use(cors());
app.use(express.json());

// 请求日志
app.use((_req, _res, next) => {
  console.log(`[Terminal Service] ${_req.method} ${_req.path}`);
  next();
});

// API 路由
app.use('/api', apiRoutes);

// 根路径
app.get('/', (_req, res) => {
  res.json({
    service: 'Terminal Service',
    version: '0.1.0',
    status: 'running',
    activeSessions: ptyManager.getActiveSessionCount(),
  });
});

// 错误处理
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Terminal Service] Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// 创建 HTTP 服务器
const server = createServer(app);

// 创建 WebSocket 服务器
const wss = new WebSocketServer({ server, path: '/ws' });

// WebSocket 连接映射：sessionId -> WebSocket[]
const sessionConnections = new Map<string, Set<WebSocket>>();

// WebSocket 连接处理
wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '', `http://localhost:${PORT}`);
  const sessionId = url.searchParams.get('sessionId');

  if (!sessionId) {
    ws.close(4000, 'Missing sessionId');
    return;
  }

  console.log(`[WebSocket] Client connected for session: ${sessionId}`);

  // 添加到连接映射
  if (!sessionConnections.has(sessionId)) {
    sessionConnections.set(sessionId, new Set());
  }
  sessionConnections.get(sessionId)!.add(ws);

  // 发送历史输出（优先从内存，否则从文件）
  let output = ptyManager.getSessionOutput(sessionId);
  if (!output) {
    // 服务重启后，从文件读取历史日志
    output = readSessionLog(sessionId);
  }
  if (output) {
    const message: WSMessage = {
      type: 'output',
      sessionId,
      data: output,
    };
    ws.send(JSON.stringify(message));
  }

  // 处理客户端消息
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString()) as WSMessage;

      if (message.type === 'input' && message.data) {
        ptyManager.writeToSession(sessionId, message.data);
      } else if (message.type === 'resize' && message.cols && message.rows) {
        ptyManager.resizeSession(sessionId, message.cols, message.rows);
      }
    } catch (error) {
      console.error('[WebSocket] Failed to parse message:', error);
    }
  });

  // 处理连接关闭
  ws.on('close', () => {
    console.log(`[WebSocket] Client disconnected for session: ${sessionId}`);
    const connections = sessionConnections.get(sessionId);
    if (connections) {
      connections.delete(ws);
      if (connections.size === 0) {
        sessionConnections.delete(sessionId);
      }
    }
  });
});

// 广播消息到会话的所有连接
function broadcastToSession(sessionId: string, message: WSMessage): void {
  const connections = sessionConnections.get(sessionId);
  if (connections) {
    const data = JSON.stringify(message);
    for (const ws of connections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }
}

// 监听 PTY 输出事件
ptyManager.on('output', (sessionId: string, data: string) => {
  // 广播到 WebSocket 客户端
  broadcastToSession(sessionId, {
    type: 'output',
    sessionId,
    data,
  });

  // 追加到日志文件
  appendSessionLog(sessionId, data);
});

// 监听 PTY 退出事件
ptyManager.on('exit', async (sessionId: string, exitCode: number) => {
  // 更新会话状态
  const session = ptyManager.getSession(sessionId);
  if (session) {
    saveSessionMeta(session);

    // 发送通知
    try {
      await notifyTaskCompleted(session);
    } catch (error) {
      console.error('[Terminal Service] Failed to send notification:', error);
    }
  }

  // 广播退出事件
  broadcastToSession(sessionId, {
    type: 'exit',
    sessionId,
    exitCode,
  });
});

// 启动服务
function start() {
  // 设置日志目录
  const logDir = process.env.TERMINAL_LOG_DIR || './logs/terminal';
  setLogDirectory(logDir);

  server.listen(PORT, () => {
    console.log(`[Terminal Service] Running on http://localhost:${PORT}`);
    console.log(`[Terminal Service] WebSocket available at ws://localhost:${PORT}/ws`);
  });
}

// 优雅关闭
process.on('SIGINT', () => {
  console.log('[Terminal Service] Shutting down...');
  ptyManager.shutdown();
  wss.close();
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[Terminal Service] Shutting down...');
  ptyManager.shutdown();
  wss.close();
  server.close();
  process.exit(0);
});

// 导出
export { app, server, start };
export * from './types/index.js';

// 如果直接运行
if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  start();
}
