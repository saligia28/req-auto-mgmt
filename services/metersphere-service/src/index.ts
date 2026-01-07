/**
 * MeterSphere Service Entry Point
 * Express server for MeterSphere data proxy using Playwright
 */

import express, { Application } from 'express';
import cors from 'cors';
import {
  getMeterSphereClient,
  type MeterSphereConfig,
  resetMeterSphereClient,
} from './services/metersphereClient.js';

const PORT = process.env.METERSPHERE_SERVICE_PORT || 3404;

// 默认配置
const defaultConfig: MeterSphereConfig = {
  baseUrl: process.env.METERSPHERE_URL || 'http://autest.juliet.cn:8081',
  username: process.env.METERSPHERE_USERNAME || '',
  password: process.env.METERSPHERE_PASSWORD || '',
  headless: process.env.METERSPHERE_HEADLESS !== 'false',
};

// 创建应用
const app: Application = express();

// 中间件
app.use(cors());
app.use(express.json());

// 请求日志
app.use((req, _res, next) => {
  console.log(`[MeterSphere Service] ${req.method} ${req.path}`);
  next();
});

// ============ API 路由 ============

// 根路径 - 服务状态
app.get('/', (_req, res) => {
  res.json({
    service: 'MeterSphere Service (Playwright)',
    version: '0.1.0',
    status: 'running',
  });
});

// 更新配置
app.post('/api/config', async (req, res) => {
  try {
    const { baseUrl, username, password, headless } = req.body;
    await resetMeterSphereClient();
    getMeterSphereClient({
      baseUrl: baseUrl || defaultConfig.baseUrl,
      username: username || defaultConfig.username,
      password: password || defaultConfig.password,
      headless: headless ?? defaultConfig.headless,
    });
    res.json({ success: true, message: 'Configuration updated' });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// 测试连接（登录）
app.get('/api/test-connection', async (_req, res) => {
  try {
    const client = getMeterSphereClient();
    const connected = await client.testConnection();
    res.json({ success: true, connected });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// 获取项目列表
app.get('/api/projects', async (_req, res) => {
  try {
    const client = getMeterSphereClient();
    const projects = await client.getProjects();
    res.json({ success: true, data: projects });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// 获取测试用例列表
app.get('/api/test-cases', async (req, res) => {
  try {
    const projectId = req.query.projectId as string | undefined;
    const client = getMeterSphereClient();
    const testCases = await client.getTestCases(projectId);
    res.json({ success: true, data: testCases });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// 搜索测试用例
app.get('/api/test-cases/search', async (req, res) => {
  try {
    const keyword = req.query.keyword as string;
    const projectId = req.query.projectId as string | undefined;

    if (!keyword) {
      return res.status(400).json({
        success: false,
        error: 'keyword is required',
      });
    }

    const client = getMeterSphereClient();
    const testCases = await client.searchTestCases(keyword, projectId);
    res.json({ success: true, data: testCases });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// 获取测试用例详情
app.get('/api/test-cases/:caseId', async (req, res) => {
  try {
    const { caseId } = req.params;
    const client = getMeterSphereClient();
    const testCase = await client.getTestCaseDetail(caseId);
    if (testCase) {
      res.json({ success: true, data: testCase });
    } else {
      res.status(404).json({ success: false, error: 'Test case not found' });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// 截图（调试用）
app.get('/api/screenshot', async (_req, res) => {
  try {
    const client = getMeterSphereClient();
    const path = `/tmp/metersphere-debug-${Date.now()}.png`;
    await client.screenshot(path);
    res.json({ success: true, path });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// 错误处理中间件
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('[MeterSphere Service] Error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Internal server error',
    });
  }
);

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('[MeterSphere Service] Shutting down...');
  await resetMeterSphereClient();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[MeterSphere Service] Shutting down...');
  await resetMeterSphereClient();
  process.exit(0);
});

// 启动服务
function start() {
  // 初始化客户端
  try {
    if (defaultConfig.username && defaultConfig.password) {
      getMeterSphereClient(defaultConfig);
      console.log('[MeterSphere Service] Client initialized');
    } else {
      console.warn(
        '[MeterSphere Service] No credentials configured. Set METERSPHERE_USERNAME and METERSPHERE_PASSWORD.'
      );
    }
  } catch (err) {
    console.warn('[MeterSphere Service] Client initialization warning:', err);
  }

  app.listen(PORT, () => {
    console.log(`[MeterSphere Service] Running on http://localhost:${PORT}`);
  });
}

// 导出
export { app, start };
export * from './types/index.js';
export * from './services/metersphereClient.js';

// 如果直接运行
if (
  process.argv[1]?.endsWith('index.ts') ||
  process.argv[1]?.endsWith('index.js')
) {
  start();
}
