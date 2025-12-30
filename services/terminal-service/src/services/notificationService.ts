/**
 * Notification Service
 * 企业微信 Webhook 通知
 */

import https from 'https';
import type { NotificationConfig, NotificationMessage, TerminalSession } from '../types/index.js';

// 默认配置
let config: NotificationConfig = {
  enabled: false,
  webhookUrl: '',
};

/**
 * 更新通知配置
 */
export function updateNotificationConfig(newConfig: Partial<NotificationConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * 获取当前配置
 */
export function getNotificationConfig(): NotificationConfig {
  return { ...config };
}

/**
 * 发送企微消息
 */
async function sendWeChatMessage(message: NotificationMessage): Promise<boolean> {
  if (!config.enabled || !config.webhookUrl) {
    return false;
  }

  return new Promise((resolve) => {
    try {
      const url = new URL(config.webhookUrl);
      const body = JSON.stringify(message);

      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 10000,
      };

      const req = https.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => { responseBody += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const result = JSON.parse(responseBody);
              resolve(result.errcode === 0);
            } catch {
              resolve(false);
            }
          } else {
            console.error(`[Notification] WeChat API error: ${res.statusCode}`);
            resolve(false);
          }
        });
      });

      req.on('error', (error) => {
        console.error('[Notification] Request error:', error);
        resolve(false);
      });

      req.on('timeout', () => {
        req.destroy();
        console.error('[Notification] Request timeout');
        resolve(false);
      });

      req.write(body);
      req.end();
    } catch (error) {
      console.error('[Notification] Failed to send message:', error);
      resolve(false);
    }
  });
}

/**
 * 发送任务完成通知
 */
export async function notifyTaskCompleted(session: TerminalSession): Promise<boolean> {
  const duration = session.completedAt
    ? Math.round((session.completedAt - session.createdAt) / 1000)
    : 0;

  const statusEmoji = session.status === 'completed' ? '✅' : '❌';
  const statusText = session.status === 'completed' ? '成功' : '失败';

  const message: NotificationMessage = {
    msgtype: 'markdown',
    markdown: {
      content: `${statusEmoji} **AI 任务${statusText}**
> 工具: ${session.aiTool}
> 耗时: ${duration}秒
> 项目: ${session.projectPath}
${session.requirementId ? `> 需求: ${session.requirementId}` : ''}
${session.exitCode !== undefined ? `> 退出码: ${session.exitCode}` : ''}`,
    },
  };

  return sendWeChatMessage(message);
}

/**
 * 发送任务开始通知
 */
export async function notifyTaskStarted(session: TerminalSession): Promise<boolean> {
  const message: NotificationMessage = {
    msgtype: 'markdown',
    markdown: {
      content: `🚀 **AI 任务开始**
> 工具: ${session.aiTool}
> 项目: ${session.projectPath}
${session.requirementId ? `> 需求: ${session.requirementId}` : ''}`,
    },
  };

  return sendWeChatMessage(message);
}

/**
 * 发送自定义通知
 */
export async function sendCustomNotification(content: string): Promise<boolean> {
  const message: NotificationMessage = {
    msgtype: 'markdown',
    markdown: { content },
  };

  return sendWeChatMessage(message);
}
