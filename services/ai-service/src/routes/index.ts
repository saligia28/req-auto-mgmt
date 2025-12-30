/**
 * AI Service API Routes
 */

import { Router, Request, Response } from 'express';
import type { Router as RouterType } from 'express';
import {
  analyzeRequirement,
  updateAIConfig,
  getAIConfig,
  testConnection,
  getAvailableModels,
  checkStatus,
} from '../services/analysisService.js';
import { promptStorage } from '../services/storage/promptStorage.js';
import type { AIConfig, AnalyzeRequest } from '../types/index.js';

const router: RouterType = Router();

/**
 * POST /api/analyze - AI 分析需求
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { content, promptTemplate } = req.body as AnalyzeRequest;

    if (!content) {
      res.status(400).json({
        success: false,
        error: '缺少需求内容',
      });
      return;
    }

    console.log('[AI Service] Analyzing requirement...');
    const result = await analyzeRequirement({ content, promptTemplate });

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('[AI Service] Analysis error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '分析失败',
    });
  }
});

/**
 * GET /api/config - 获取当前 AI 配置
 */
router.get('/config', (_req: Request, res: Response) => {
  const config = getAIConfig();
  // 隐藏敏感信息
  const safeConfig = {
    ...config,
    deepseek: config.deepseek ? {
      ...config.deepseek,
      apiKey: config.deepseek.apiKey ? '******' : '',
    } : undefined,
  };
  res.json({
    success: true,
    config: safeConfig,
  });
});

/**
 * POST /api/config - 更新 AI 配置
 */
router.post('/config', (req: Request, res: Response) => {
  try {
    const config = req.body as Partial<AIConfig>;
    updateAIConfig(config);

    console.log('[AI Service] Config updated:', config.provider);

    res.json({
      success: true,
      message: '配置已更新',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '配置更新失败',
    });
  }
});

/**
 * POST /api/test - 测试 AI 连接
 */
router.post('/test', async (_req: Request, res: Response) => {
  try {
    console.log('[AI Service] Testing connection...');
    const result = await testConnection();

    res.json({
      success: result.success,
      message: result.message,
      latency: result.latency,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '连接测试失败',
    });
  }
});

/**
 * GET /api/models - 获取可用模型列表
 */
router.get('/models', async (_req: Request, res: Response) => {
  try {
    const models = await getAvailableModels();
    res.json({
      success: true,
      models,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取模型列表失败',
    });
  }
});

/**
 * GET /api/status - 获取 AI 服务状态
 */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const status = await checkStatus();
    res.json({
      success: true,
      status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取状态失败',
    });
  }
});

/**
 * GET /api/prompts - 获取 Prompt 模板列表
 */
router.get('/prompts', async (_req: Request, res: Response) => {
  try {
    const prompts = await promptStorage.list();
    res.json({
      success: true,
      prompts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取模板列表失败',
    });
  }
});

/**
 * GET /api/prompts/stats - 获取 Prompt 存储统计信息
 * 注意：静态路由需要在动态路由 :id 之前定义
 */
router.get('/prompts/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await promptStorage.getStats();
    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取统计信息失败',
    });
  }
});

/**
 * POST /api/prompts - 创建 Prompt 模板
 */
router.post('/prompts', async (req: Request, res: Response) => {
  try {
    const { name, template } = req.body;

    if (!name || !template) {
      res.status(400).json({
        success: false,
        error: '缺少名称或模板内容',
      });
      return;
    }

    const newPrompt = await promptStorage.create(name, template);

    res.json({
      success: true,
      prompt: newPrompt,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '创建失败',
    });
  }
});

/**
 * POST /api/prompts/clear - 清空自定义模板（保留默认）
 * 注意：静态路由需要在动态路由 :id 之前定义
 */
router.post('/prompts/clear', async (_req: Request, res: Response) => {
  try {
    const deleted = await promptStorage.clearCustom();
    res.json({
      success: true,
      message: `已清空 ${deleted} 个自定义模板`,
      deleted,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '清空失败',
    });
  }
});

/**
 * POST /api/prompts/reset-default - 重置默认模板
 * 注意：静态路由需要在动态路由 :id 之前定义
 */
router.post('/prompts/reset-default', async (_req: Request, res: Response) => {
  try {
    const prompt = await promptStorage.resetDefault();
    res.json({
      success: true,
      prompt,
      message: '默认模板已重置',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '重置失败',
    });
  }
});

/**
 * PUT /api/prompts/:id - 更新 Prompt 模板
 */
router.put('/prompts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, template } = req.body;

    const updated = await promptStorage.update(id, { name, template });

    if (!updated) {
      res.status(404).json({
        success: false,
        error: '模板不存在',
      });
      return;
    }

    res.json({
      success: true,
      prompt: updated,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '更新失败',
    });
  }
});

/**
 * DELETE /api/prompts/:id - 删除 Prompt 模板
 */
router.delete('/prompts/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await promptStorage.delete(id);

    if (!result.success) {
      res.status(result.error === '模板不存在' ? 404 : 400).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.json({
      success: true,
      message: '已删除',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '删除失败',
    });
  }
});

export default router;
