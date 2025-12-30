/**
 * Terminal Tabs Component
 * 终端多 Tab 管理（支持分屏）
 */

import { useState, useEffect, useCallback } from 'react';
import { XTerminal } from './XTerminal';
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

interface TerminalTabsProps {
  onSessionChange?: (session: TerminalSession | null) => void;
  newSessionId?: string | null; // 新创建的会话 ID，用于自动跳转
  onNewSessionHandled?: () => void; // 新会话跳转处理完成后的回调
}

type SplitMode = 'none' | 'horizontal' | 'vertical';

const ACTIVE_SESSION_CACHE_KEY = 'terminal:active-session-id';

export function TerminalTabs({ onSessionChange, newSessionId, onNewSessionHandled }: TerminalTabsProps) {
  const { settings } = useAppStore();
  const theme = settings.theme;

  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  // 从 localStorage 恢复 activeSessionId
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ACTIVE_SESSION_CACHE_KEY);
    } catch {
      return null;
    }
  });
  const [secondarySessionId, setSecondarySessionId] = useState<string | null>(null);
  const [splitMode, setSplitMode] = useState<SplitMode>('none');
  const [focusedPane, setFocusedPane] = useState<'primary' | 'secondary'>('primary');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 持久化 activeSessionId
  const updateActiveSession = useCallback((sessionId: string | null, session: TerminalSession | null) => {
    setActiveSessionId(sessionId);
    try {
      if (sessionId) {
        localStorage.setItem(ACTIVE_SESSION_CACHE_KEY, sessionId);
      } else {
        localStorage.removeItem(ACTIVE_SESSION_CACHE_KEY);
      }
    } catch {
      // localStorage 不可用时忽略
    }
    onSessionChange?.(session);
  }, [onSessionChange]);

  // 主题样式
  const getThemeClasses = () => {
    switch (theme) {
      case 'hacker':
        return {
          bg: 'bg-hacker-bg',
          bgSecondary: 'bg-hacker-panel',
          border: 'border-hacker-border',
          text: 'text-hacker-text-main',
          textDim: 'text-hacker-text-dim',
          primary: 'bg-hacker-primary text-black',
          hover: 'hover:bg-hacker-primary/20',
          active: 'bg-hacker-primary/30',
        };
      case 'notion':
        return {
          bg: 'bg-notion-bg',
          bgSecondary: 'bg-notion-panel',
          border: 'border-notion-border',
          text: 'text-notion-text-main',
          textDim: 'text-notion-text-dim',
          primary: 'bg-notion-primary text-white',
          hover: 'hover:bg-notion-primary/10',
          active: 'bg-notion-primary/20',
        };
      case 'claude':
      default:
        return {
          bg: 'bg-claude-bg',
          bgSecondary: 'bg-claude-panel',
          border: 'border-claude-border',
          text: 'text-claude-text-main',
          textDim: 'text-claude-text-dim',
          primary: 'bg-claude-primary text-white',
          hover: 'hover:bg-claude-primary/10',
          active: 'bg-claude-primary/20',
        };
    }
  };

  const themeClasses = getThemeClasses();

  // 加载会话列表
  const loadSessions = useCallback(async () => {
    try {
      const sessionList = await window.electronAPI.terminal.getSessions();

      setSessions(sessionList as TerminalSession[]);

      // 验证并恢复 activeSessionId
      if (activeSessionId) {
        const cachedSession = sessionList.find((s) => s.id === activeSessionId);
        if (cachedSession) {
          // 缓存的会话仍然存在
          onSessionChange?.(cachedSession as TerminalSession);
        } else {
          // 缓存的会话不存在了，选择第一个运行中的会话
          const runningSession = sessionList.find((s) => s.status === 'running');
          if (runningSession) {
            updateActiveSession(runningSession.id, runningSession as TerminalSession);
          } else if (sessionList.length > 0) {
            // 没有运行中的会话，选择第一个
            updateActiveSession(sessionList[0].id, sessionList[0] as TerminalSession);
          } else {
            updateActiveSession(null, null);
          }
        }
      } else if (sessionList.length > 0) {
        // 没有缓存，选择第一个运行中的会话
        const runningSession = sessionList.find((s) => s.status === 'running');
        if (runningSession) {
          updateActiveSession(runningSession.id, runningSession as TerminalSession);
        } else {
          // 选择第一个会话
          updateActiveSession(sessionList[0].id, sessionList[0] as TerminalSession);
        }
      }
    } catch (err) {
      console.error('[TerminalTabs] Failed to load sessions:', err);
      setError('无法连接到终端服务');
    } finally {
      setLoading(false);
    }
  }, [activeSessionId, onSessionChange, updateActiveSession]);

  useEffect(() => {
    loadSessions();
    // 定期刷新会话列表
    const interval = setInterval(loadSessions, 5000);
    return () => clearInterval(interval);
  }, [loadSessions]);

  // 处理新创建的会话，自动跳转
  useEffect(() => {
    if (newSessionId && sessions.length > 0) {
      const newSession = sessions.find((s) => s.id === newSessionId);
      if (newSession) {
        updateActiveSession(newSessionId, newSession);
        onNewSessionHandled?.();
      }
    }
  }, [newSessionId, sessions, updateActiveSession, onNewSessionHandled]);

  // 切换活动会话
  const handleTabClick = (session: TerminalSession) => {
    if (splitMode !== 'none' && focusedPane === 'secondary') {
      setSecondarySessionId(session.id);
    } else {
      updateActiveSession(session.id, session);
    }
  };

  // 关闭会话
  const handleCloseSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    const session = sessions.find((s) => s.id === sessionId);
    if (session?.status === 'running') {
      // 先终止运行中的会话
      try {
        await window.electronAPI.terminal.kill(sessionId);
      } catch (err) {
        console.error('[TerminalTabs] Failed to kill session:', err);
      }
    }

    // 删除会话
    try {
      await window.electronAPI.terminal.remove(sessionId);

      setSessions((prev) => prev.filter((s) => s.id !== sessionId));

      // 处理主窗格
      if (activeSessionId === sessionId) {
        const remaining = sessions.filter((s) => s.id !== sessionId);
        if (remaining.length > 0) {
          updateActiveSession(remaining[0].id, remaining[0]);
        } else {
          updateActiveSession(null, null);
        }
      }

      // 处理副窗格
      if (secondarySessionId === sessionId) {
        setSecondarySessionId(null);
        if (splitMode !== 'none') {
          setSplitMode('none');
        }
      }
    } catch (err) {
      console.error('[TerminalTabs] Failed to delete session:', err);
    }
  };

  // 会话退出处理
  const handleSessionExit = (sessionId: string, exitCode: number) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              status: exitCode === 0 ? 'completed' : 'failed',
              exitCode,
              completedAt: Date.now(),
            }
          : s
      )
    );
  };

  // 切换分屏模式
  const toggleSplitMode = (mode: SplitMode) => {
    if (splitMode === mode) {
      setSplitMode('none');
      setSecondarySessionId(null);
    } else {
      setSplitMode(mode);
      // 自动选择第二个会话
      if (!secondarySessionId && sessions.length > 1) {
        const other = sessions.find((s) => s.id !== activeSessionId);
        if (other) {
          setSecondarySessionId(other.id);
        }
      }
    }
  };

  // 获取状态图标
  const getStatusIcon = (status: TerminalSession['status']) => {
    switch (status) {
      case 'running':
        return <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />;
      case 'completed':
        return <span className="text-green-500 text-xs">ok</span>;
      case 'failed':
        return <span className="text-red-500 text-xs">err</span>;
    }
  };

  // 获取工具标识
  const getToolLabel = (tool: TerminalSession['aiTool']) => {
    return tool;
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-full ${themeClasses.bg}`}>
        <div
          className={`animate-spin rounded-full h-8 w-8 border-b-2 ${theme === 'hacker' ? 'border-hacker-primary' : 'border-primary'}`}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center h-full gap-4 ${themeClasses.bg}`}>
        <p className="text-red-500">{error}</p>
        <button
          onClick={() => {
            setError(null);
            setLoading(true);
            loadSessions();
          }}
          className={`px-4 py-2 rounded ${themeClasses.primary}`}
        >
          重试
        </button>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center h-full gap-2 ${themeClasses.textDim} ${themeClasses.bg}`}
      >
        <p className={theme === 'hacker' ? 'font-mono' : ''}>
          {theme === 'hacker' ? '$ _' : '暂无终端会话'}
        </p>
        <p className={`text-sm ${theme === 'hacker' ? 'font-mono' : ''}`}>
          {theme === 'hacker' ? '// 点击 [+ new] 创建任务' : '点击「+ 新建任务」创建终端会话'}
        </p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${themeClasses.bg}`}>
      {/* Tab 栏 */}
      <div
        className={`flex items-center justify-between p-2 ${themeClasses.bgSecondary} border-b ${themeClasses.border}`}
      >
        {/* 会话 Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto flex-1">
          {sessions.map((session) => {
            const isActive = activeSessionId === session.id;
            const isSecondary = secondarySessionId === session.id;
            return (
              <div
                key={session.id}
                onClick={() => handleTabClick(session)}
                className={`
                  flex items-center gap-2 px-3 py-1.5 rounded text-sm whitespace-nowrap transition-colors cursor-pointer
                  ${theme === 'hacker' ? 'font-mono' : ''}
                  ${
                    isActive
                      ? themeClasses.primary
                      : isSecondary
                        ? themeClasses.active
                        : `${themeClasses.bgSecondary} ${themeClasses.hover}`
                  }
                `}
              >
                {getStatusIcon(session.status)}
                <span>{getToolLabel(session.aiTool)}</span>
                <span className="max-w-[120px] truncate">
                  {session.requirementId || session.projectPath.split('/').pop()}
                </span>
                {isSecondary && splitMode !== 'none' && (
                  <span className="text-xs opacity-60">[2]</span>
                )}
                <span
                  onClick={(e) => handleCloseSession(session.id, e)}
                  className={`ml-1 cursor-pointer ${theme === 'hacker' ? 'text-hacker-text-dim hover:text-red-400' : 'hover:text-red-500'}`}
                  title="关闭"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) =>
                    e.key === 'Enter' &&
                    handleCloseSession(session.id, e as unknown as React.MouseEvent)
                  }
                >
                  ×
                </span>
              </div>
            );
          })}
        </div>

        {/* 分屏控制按钮 */}
        {sessions.length > 1 && (
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={() => toggleSplitMode('vertical')}
              className={`
                p-1.5 rounded transition-colors
                ${splitMode === 'vertical' ? themeClasses.active : themeClasses.hover}
                ${theme === 'hacker' ? 'font-mono' : ''}
              `}
              title="垂直分屏"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="12" y1="3" x2="12" y2="21" />
              </svg>
            </button>
            <button
              onClick={() => toggleSplitMode('horizontal')}
              className={`
                p-1.5 rounded transition-colors
                ${splitMode === 'horizontal' ? themeClasses.active : themeClasses.hover}
                ${theme === 'hacker' ? 'font-mono' : ''}
              `}
              title="水平分屏"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="12" x2="21" y2="12" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* 终端内容区 */}
      <div
        className={`flex-1 ${themeClasses.bg} ${
          splitMode === 'vertical' ? 'flex' : splitMode === 'horizontal' ? 'flex flex-col' : ''
        }`}
      >
        {/* 主窗格 */}
        <div
          className={`
            ${splitMode === 'none' ? 'h-full' : 'flex-1'}
            ${focusedPane === 'primary' && splitMode !== 'none' ? `ring-2 ring-inset ${theme === 'hacker' ? 'ring-hacker-primary' : 'ring-primary'}` : ''}
          `}
          onClick={() => setFocusedPane('primary')}
        >
          {activeSessionId ? (
            <XTerminal
              key={activeSessionId}
              sessionId={activeSessionId}
              onExit={(exitCode) => handleSessionExit(activeSessionId, exitCode)}
              className="h-full"
            />
          ) : (
            <div className={`flex items-center justify-center h-full ${themeClasses.textDim}`}>
              选择一个终端会话
            </div>
          )}
        </div>

        {/* 分割线 */}
        {splitMode !== 'none' && (
          <div
            className={`
              ${splitMode === 'vertical' ? 'w-1' : 'h-1'}
              ${themeClasses.border} bg-opacity-50 cursor-pointer
              ${theme === 'hacker' ? 'bg-hacker-border' : 'bg-gray-300'}
            `}
          />
        )}

        {/* 副窗格 */}
        {splitMode !== 'none' && (
          <div
            className={`
              flex-1
              ${focusedPane === 'secondary' ? `ring-2 ring-inset ${theme === 'hacker' ? 'ring-hacker-primary' : 'ring-primary'}` : ''}
            `}
            onClick={() => setFocusedPane('secondary')}
          >
            {secondarySessionId ? (
              <XTerminal
                key={secondarySessionId}
                sessionId={secondarySessionId}
                onExit={(exitCode) => handleSessionExit(secondarySessionId, exitCode)}
                className="h-full"
              />
            ) : (
              <div className={`flex items-center justify-center h-full ${themeClasses.textDim}`}>
                点击 Tab 在此打开会话
              </div>
            )}
          </div>
        )}
      </div>

      {/* 会话信息栏 */}
      {activeSessionId && (
        <SessionInfoBar
          session={sessions.find((s) => s.id === activeSessionId)}
          secondarySession={
            splitMode !== 'none' ? sessions.find((s) => s.id === secondarySessionId) : undefined
          }
          splitMode={splitMode}
          theme={theme}
        />
      )}
    </div>
  );
}

// 会话信息栏组件
function SessionInfoBar({
  session,
  secondarySession,
  splitMode,
  theme,
}: {
  session?: TerminalSession;
  secondarySession?: TerminalSession;
  splitMode: SplitMode;
  theme: string;
}) {
  if (!session) return null;

  const getDuration = (s: TerminalSession) => {
    return s.completedAt
      ? Math.round((s.completedAt - s.createdAt) / 1000)
      : Math.round((Date.now() - s.createdAt) / 1000);
  };

  const themeClasses =
    theme === 'hacker'
      ? 'bg-hacker-panel border-hacker-border text-hacker-text-dim font-mono'
      : theme === 'notion'
        ? 'bg-notion-panel border-notion-border text-notion-text-dim'
        : 'bg-claude-panel border-claude-border text-claude-text-dim';

  return (
    <div className={`flex items-center justify-between px-4 py-2 ${themeClasses} border-t text-sm`}>
      <div className="flex items-center gap-4">
        <span>
          {theme === 'hacker' ? 'TOOL:' : '工具:'} {session.aiTool}
        </span>
        <span>
          {theme === 'hacker' ? 'STATUS:' : '状态:'} {session.status}
        </span>
        <span>
          {theme === 'hacker' ? 'TIME:' : '耗时:'} {getDuration(session)}s
        </span>
        {splitMode !== 'none' && secondarySession && (
          <>
            <span className="mx-2">|</span>
            <span>[2] {secondarySession.aiTool}</span>
            <span>{secondarySession.status}</span>
            <span>{getDuration(secondarySession)}s</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs truncate max-w-[300px]">{session.cwd}</span>
      </div>
    </div>
  );
}

export default TerminalTabs;
