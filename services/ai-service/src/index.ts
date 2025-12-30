/**
 * AI Service Entry Point
 * Express server for AI analysis API
 */

import express, { Application } from 'express';
import cors from 'cors';
import apiRoutes from './routes/index.js';
import { updateAIConfig, checkStatus } from './services/analysisService.js';
import type { AIConfig } from './types/index.js';

const PORT = process.env.AI_SERVICE_PORT || 3402;

// 初始化默认配置
const defaultConfig: AIConfig = {
  provider: (process.env.AI_PROVIDER as 'ollama' | 'deepseek') || 'ollama',
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
    timeout: parseInt(process.env.OLLAMA_TIMEOUT || '120000'),
  },
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    model: (process.env.DEEPSEEK_MODEL as 'deepseek-chat' | 'deepseek-coder') || 'deepseek-chat',
    timeout: parseInt(process.env.DEEPSEEK_TIMEOUT || '120000'),
  },
};

// 创建应用
const app: Application = express();

// 中间件
app.use(cors());
app.use(express.json());

// 请求日志
app.use((_req, _res, next) => {
  console.log(`[AI Service] ${_req.method} ${_req.path}`);
  next();
});

// API 路由
app.use('/api', apiRoutes);

// 根路径
app.get('/', async (_req, res) => {
  try {
    const status = await checkStatus();
    res.json({
      service: 'AI Service',
      version: '0.1.0',
      status: 'running',
      ai: status,
    });
  } catch {
    res.json({
      service: 'AI Service',
      version: '0.1.0',
      status: 'running',
    });
  }
});

// 错误处理
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[AI Service] Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// 启动服务
function start() {
  // 初始化 AI 配置
  try {
    updateAIConfig(defaultConfig);
    console.log('[AI Service] Config initialized');
  } catch (err) {
    console.warn('[AI Service] Config initialization warning:', err);
  }

  app.listen(PORT, () => {
    console.log(`[AI Service] Running on http://localhost:${PORT}`);
    console.log(`[AI Service] Default provider: ${defaultConfig.provider}`);
  });
}

// 导出
export { app, start };
export * from './types/index.js';
export * from './services/analysisService.js';

// 如果直接运行
if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  start();
}
