/**
 * TAPD API Routes
 */

import { Router, Request, Response } from 'express';
import type { Router as RouterType } from 'express';
import { getTapdClient, updateTapdConfig } from '../services/tapdClient.js';
import type { ApiResponse, TapdConfig } from '../types/index.js';

const router: RouterType = Router();

/**
 * POST /api/config - 更新 TAPD 配置
 */
router.post('/config', (req: Request, res: Response) => {
  try {
    const config = req.body as Partial<TapdConfig>;
    updateTapdConfig(config);
    const response: ApiResponse<null> = { success: true };
    res.json(response);
  } catch (err) {
    const response: ApiResponse<null> = {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/iterations - 获取迭代列表
 */
router.get('/iterations', async (_req: Request, res: Response) => {
  try {
    const client = getTapdClient();
    if (!client.isConfigured()) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'TAPD not configured',
      };
      return res.status(400).json(response);
    }

    const iterations = await client.getIterations();
    const response: ApiResponse<typeof iterations> = {
      success: true,
      data: iterations,
    };
    res.json(response);
  } catch (err) {
    const response: ApiResponse<null> = {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/iterations/current - 获取当前迭代
 */
router.get('/iterations/current', async (_req: Request, res: Response) => {
  try {
    const client = getTapdClient();
    if (!client.isConfigured()) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'TAPD not configured',
      };
      return res.status(400).json(response);
    }

    const iteration = await client.getCurrentIteration();
    const response: ApiResponse<typeof iteration> = {
      success: true,
      data: iteration,
    };
    res.json(response);
  } catch (err) {
    const response: ApiResponse<null> = {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/stories - 获取需求列表
 */
router.get('/stories', async (req: Request, res: Response) => {
  try {
    const client = getTapdClient();
    if (!client.isConfigured()) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'TAPD not configured',
      };
      return res.status(400).json(response);
    }

    const { iteration_id, status, limit } = req.query;
    const stories = await client.getStories({
      iterationId: iteration_id as string | undefined,
      status: status as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    const response: ApiResponse<typeof stories> = {
      success: true,
      data: stories,
    };
    res.json(response);
  } catch (err) {
    const response: ApiResponse<null> = {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/stories/:id - 获取需求详情
 */
router.get('/stories/:id', async (req: Request, res: Response) => {
  try {
    const client = getTapdClient();
    if (!client.isConfigured()) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'TAPD not configured',
      };
      return res.status(400).json(response);
    }

    const { id } = req.params;
    const story = await client.getStory(id);

    if (!story) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Story not found',
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<typeof story> = {
      success: true,
      data: story,
    };
    res.json(response);
  } catch (err) {
    const response: ApiResponse<null> = {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/health - 健康检查
 */
router.get('/health', (_req: Request, res: Response) => {
  try {
    const client = getTapdClient();
    res.json({
      success: true,
      data: {
        status: 'ok',
        configured: client.isConfigured(),
      },
    });
  } catch {
    res.json({
      success: true,
      data: {
        status: 'ok',
        configured: false,
      },
    });
  }
});

export default router;
