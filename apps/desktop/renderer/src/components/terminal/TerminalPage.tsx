/**
 * Terminal Page
 * 终端管理页面
 */

import { useState, useCallback } from 'react';
import { TerminalTabs } from './TerminalTabs';
import { AIImplementModal } from './AIImplementModal';
import { useAppStore } from '@/stores/appStore';

interface TerminalSession {
  id: string;
  requirementId?: string;
  projectPath: string;
  aiTool: 'claude' | 'codex';
  status: 'running' | 'completed' | 'failed';
  command: string;
  cwd: string;
  createdAt: number;
  completedAt?: number;
  exitCode?: number;
}

export function TerminalPage() {
  const { settings } = useAppStore();
  const theme = settings.theme;
  const [showModal, setShowModal] = useState(false);
  const [activeSession, setActiveSession] = useState<TerminalSession | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [newSessionId, setNewSessionId] = useState<string | null>(null);

  // 处理会话创建
  const handleSessionCreated = useCallback((sessionId: string) => {
    // 设置新创建的会话 ID，触发跳转
    setNewSessionId(sessionId);
    // 刷新列表
    setRefreshKey((k) => k + 1);
  }, []);

  // 清除新会话 ID（在 TerminalTabs 处理完跳转后）
  const handleNewSessionHandled = useCallback(() => {
    setNewSessionId(null);
  }, []);

  // 处理会话切换
  const handleSessionChange = useCallback((session: TerminalSession | null) => {
    setActiveSession(session);
  }, []);

  // 主题样式
  const getThemeStyles = () => {
    switch (theme) {
      case 'hacker':
        return {
          title: 'text-hacker-primary font-mono',
          container: 'bg-black border-hacker-border',
          button: 'bg-hacker-primary text-black hover:bg-hacker-primary/80',
          buttonSecondary: 'hover:bg-hacker-bg-secondary',
        };
      case 'notion':
        return {
          title: 'text-notion-text-main',
          container: 'bg-notion-bg-primary border-notion-border',
          button: 'bg-notion-primary text-white hover:bg-notion-primary/80',
          buttonSecondary: 'hover:bg-notion-bg-secondary',
        };
      case 'claude':
      default:
        return {
          title: 'text-claude-text-main',
          container: 'bg-claude-bg-primary border-claude-border',
          button: 'bg-claude-primary text-white hover:bg-claude-primary/80',
          buttonSecondary: 'hover:bg-claude-bg-secondary',
        };
    }
  };

  const styles = getThemeStyles();

  return (
    <div className="flex flex-col h-full">
      {/* 头部工具栏 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-4">
          <h1 className={`text-xl font-semibold ${styles.title}`}>
            {theme === 'hacker' ? '> 终端' : '终端管理'}
          </h1>
          {activeSession && (
            <span className={`px-2 py-1 text-xs rounded ${theme === 'hacker' ? 'bg-hacker-panel text-hacker-text-main font-mono' : 'bg-bg-secondary'}`}>
              [{activeSession.aiTool}]
              {activeSession.status === 'running' && (
                <span className="ml-2 text-green-500">●</span>
              )}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* 刷新按钮 */}
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className={`px-3 py-1.5 rounded-lg text-sm ${theme === 'hacker' ? 'border border-hacker-border text-hacker-text-main hover:border-hacker-primary hover:text-hacker-primary font-mono' : styles.buttonSecondary}`}
            title="刷新"
          >
            {theme === 'hacker' ? '[refresh]' : '刷新'}
          </button>

          {/* 新建任务按钮 */}
          <button
            onClick={() => setShowModal(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${styles.button} ${theme === 'hacker' ? 'font-mono' : ''}`}
          >
            <span>{theme === 'hacker' ? '+ new' : '+ 新建任务'}</span>
          </button>
        </div>
      </div>

      {/* 终端区域 */}
      <div className={`flex-1 overflow-hidden ${styles.container}`}>
        <TerminalTabs
          key={refreshKey}
          onSessionChange={handleSessionChange}
          newSessionId={newSessionId}
          onNewSessionHandled={handleNewSessionHandled}
        />
      </div>

      {/* AI 实现弹窗 */}
      <AIImplementModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onCreated={handleSessionCreated}
      />
    </div>
  );
}

export default TerminalPage;
