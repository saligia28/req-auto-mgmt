/**
 * TAPD Service Entry Point
 * Express server for TAPD API proxy
 */

import express, { Application } from 'express';
import cors from 'cors';
import apiRoutes from './routes/index.js';
import { getTapdClient } from './services/tapdClient.js';
import type { TapdConfig } from './types/index.js';

const PORT = process.env.TAPD_SERVICE_PORT || 3401;

// 初始化默认配置
const defaultConfig: TapdConfig = {
  apiBase: process.env.TAPD_API_BASE || 'https://api.tapd.cn',
  workspaceId: process.env.TAPD_WORKSPACE_ID || '',
  token: process.env.TAPD_TOKEN || '',
  username: process.env.TAPD_USERNAME || '',
  password: process.env.TAPD_PASSWORD || '',
};

// 创建应用
const app: Application = express();

// 中间件
app.use(cors());
app.use(express.json());

// 请求日志
app.use((_req, _res, next) => {
  console.log(`[TAPD Service] ${_req.method} ${_req.path}`);
  next();
});

// API 路由
app.use('/api', apiRoutes);

// 根路径
app.get('/', (_req, res) => {
  res.json({
    service: 'TAPD Service',
    version: '0.1.0',
    status: 'running',
  });
});

// 错误处理
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[TAPD Service] Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// 启动服务
function start() {
  // 初始化 TAPD 客户端
  try {
    getTapdClient(defaultConfig);
    console.log('[TAPD Service] Client initialized');
  } catch (err) {
    console.warn('[TAPD Service] Client initialization warning:', err);
  }

  app.listen(PORT, () => {
    console.log(`[TAPD Service] Running on http://localhost:${PORT}`);
  });
}

// 导出
export { app, start };
export * from './types/index.js';
export * from './services/tapdClient.js';

// 如果直接运行
if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  start();
}
