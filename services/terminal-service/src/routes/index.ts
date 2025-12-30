/**
 * Terminal Service API Routes
 */

import { Router, Request, Response } from 'express';
import type { Router as RouterType } from 'express';
import { ptyManager } from '../services/ptyManager.js';
import {
  saveSessionMeta,
  readSessionLog,
  deleteSessionLog,
  getAllSavedSessions,
  cleanupOldLogs,
} from '../services/sessionManager.js';
import {
  updateNotificationConfig,
  getNotificationConfig,
  notifyTaskCompleted,
} from '../services/notificationService.js';
import type {
  CreateSessionRequest,
  TerminalInputRequest,
  TerminalResizeRequest,
  NotificationConfig,
} from '../types/index.js';
import { DEFAULT_AI_TOOLS } from '../types/index.js';

const router: RouterType = Router();

/**
 * GET /api/sessions - 获取所有会话
 */
router.get('/sessions', (_req: Request, res: Response) => {
  const activeSessions = ptyManager.getAllSessions();
  const savedSessions = getAllSavedSessions();

  // 合并活跃会话和保存的会话（去重）
  const activeIds = new Set(activeSessions.map((s) => s.id));
  const allSessions = [
    ...activeSessions,
    ...savedSessions.filter((s) => !activeIds.has(s.id)),
  ];

  res.json({
    success: true,
    sessions: allSessions,
    activeCount: ptyManager.getActiveSessionCount(),
    canCreateNew: ptyManager.canCreateSession(),
  });
});

/**
 * POST /api/sessions - 创建新会话
 */
router.post('/sessions', (req: Request, res: Response) => {
  const request = req.body as CreateSessionRequest;

  if (!request.cwd || !request.aiTool) {
    res.status(400).json({
      success: false,
      error: '缺少必要参数',
    });
    return;
  }

  if (!ptyManager.canCreateSession()) {
    res.status(429).json({
      success: false,
      error: '已达到最大并行会话数（3个）',
    });
    return;
  }

  const session = ptyManager.createSession(request);
  if (!session) {
    res.status(500).json({
      success: false,
      error: '创建会话失败',
    });
    return;
  }

  // 保存会话元数据
  saveSessionMeta(session);

  res.json({
    success: true,
    session,
  });
});

/**
 * GET /api/sessions/:id - 获取会话详情
 */
router.get('/sessions/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  let session = ptyManager.getSession(id);
  if (!session) {
    // 尝试从保存的会话中加载
    const saved = getAllSavedSessions().find((s) => s.id === id);
    if (saved) {
      session = saved;
    }
  }

  if (!session) {
    res.status(404).json({
      success: false,
      error: '会话不存在',
    });
    return;
  }

  const output = ptyManager.getSessionOutput(id) || readSessionLog(id);

  res.json({
    success: true,
    session,
    output,
  });
});

/**
 * DELETE /api/sessions/:id - 删除会话
 */
router.delete('/sessions/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  ptyManager.removeSession(id);
  deleteSessionLog(id);

  res.json({
    success: true,
    message: '会话已删除',
  });
});

/**
 * POST /api/sessions/:id/input - 发送输入到会话
 */
router.post('/sessions/:id/input', (req: Request, res: Response) => {
  const { id } = req.params;
  const { data } = req.body as TerminalInputRequest;

  if (!data) {
    res.status(400).json({
      success: false,
      error: '缺少输入数据',
    });
    return;
  }

  const success = ptyManager.writeToSession(id, data);
  if (!success) {
    res.status(404).json({
      success: false,
      error: '会话不存在或已结束',
    });
    return;
  }

  res.json({ success: true });
});

/**
 * POST /api/sessions/:id/resize - 调整终端大小
 */
router.post('/sessions/:id/resize', (req: Request, res: Response) => {
  const { id } = req.params;
  const { cols, rows } = req.body as TerminalResizeRequest;

  if (!cols || !rows) {
    res.status(400).json({
      success: false,
      error: '缺少尺寸参数',
    });
    return;
  }

  const success = ptyManager.resizeSession(id, cols, rows);
  if (!success) {
    res.status(404).json({
      success: false,
      error: '会话不存在或已结束',
    });
    return;
  }

  res.json({ success: true });
});

/**
 * POST /api/sessions/:id/kill - 终止会话
 */
router.post('/sessions/:id/kill', (req: Request, res: Response) => {
  const { id } = req.params;

  const success = ptyManager.killSession(id);
  if (!success) {
    res.status(404).json({
      success: false,
      error: '会话不存在',
    });
    return;
  }

  res.json({
    success: true,
    message: '会话已终止',
  });
});

/**
 * GET /api/tools - 获取可用 AI 工具列表
 */
router.get('/tools', (_req: Request, res: Response) => {
  res.json({
    success: true,
    tools: DEFAULT_AI_TOOLS,
  });
});

/**
 * GET /api/notification/config - 获取通知配置
 */
router.get('/notification/config', (_req: Request, res: Response) => {
  const config = getNotificationConfig();
  // 隐藏 webhook URL 的敏感部分
  const safeConfig = {
    ...config,
    webhookUrl: config.webhookUrl ? '******' : '',
  };

  res.json({
    success: true,
    config: safeConfig,
  });
});

/**
 * POST /api/notification/config - 更新通知配置
 */
router.post('/notification/config', (req: Request, res: Response) => {
  const config = req.body as Partial<NotificationConfig>;
  updateNotificationConfig(config);

  res.json({
    success: true,
    message: '配置已更新',
  });
});

/**
 * POST /api/notification/test - 测试通知
 */
router.post('/notification/test', async (_req: Request, res: Response) => {
  const { sendCustomNotification } = await import('../services/notificationService.js');
  const success = await sendCustomNotification('🔔 **测试通知**\n> 这是一条测试消息');

  res.json({
    success,
    message: success ? '通知发送成功' : '通知发送失败',
  });
});

/**
 * POST /api/cleanup - 清理过期日志
 */
router.post('/cleanup', (req: Request, res: Response) => {
  const { days = 7 } = req.body;
  const cleaned = cleanupOldLogs(days);

  res.json({
    success: true,
    cleaned,
    message: `已清理 ${cleaned} 个过期会话`,
  });
});

export default router;

// 导出 PTY 事件处理（供 WebSocket 使用）
export { ptyManager, saveSessionMeta, notifyTaskCompleted };
