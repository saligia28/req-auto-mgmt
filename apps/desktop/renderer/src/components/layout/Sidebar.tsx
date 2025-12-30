import type { FC, ReactNode } from 'react';
import { useAppStore } from '@/stores/appStore';
import type { NavItem } from '@req-auto-mgmt/shared-types';

// 导航图标组件
const DocumentIcon: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
    />
  </svg>
);

const TerminalIcon: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z"
    />
  </svg>
);

const SettingsIcon: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const navItems: { id: NavItem; label: string; icon: FC<{ className?: string }> }[] = [
  { id: 'requirements', label: '需求管理', icon: DocumentIcon },
  { id: 'terminal', label: '终端', icon: TerminalIcon },
  { id: 'settings', label: '设置', icon: SettingsIcon },
];

interface SidebarProps {
  children?: ReactNode;
}

export const Sidebar: FC<SidebarProps> = () => {
  const { currentNav, setCurrentNav, settings } = useAppStore();
  const theme = settings.theme;

  return (
    <aside
      className={`
        w-60 h-full flex flex-col border-r
        ${theme === 'hacker' ? 'bg-hacker-panel border-hacker-border' : ''}
        ${theme === 'claude' ? 'bg-claude-panel border-claude-border' : ''}
        ${theme === 'notion' ? 'bg-notion-panel border-notion-border' : ''}
      `}
    >
      {/* Logo / 标题区域 */}
      <div
        className={`
          h-14 flex items-center px-4 border-b titlebar-drag
          ${theme === 'hacker' ? 'border-hacker-border' : ''}
          ${theme === 'claude' ? 'border-claude-border' : ''}
          ${theme === 'notion' ? 'border-notion-border' : ''}
        `}
      >
        {/* macOS 红绿灯按钮占位 */}
        <div className="w-16" />
        <h1
          className={`
            text-sm font-medium
            ${theme === 'hacker' ? 'text-hacker-text-main font-mono' : ''}
            ${theme === 'claude' ? 'text-claude-text-main' : ''}
            ${theme === 'notion' ? 'text-notion-text-main' : ''}
          `}
        >
          需求管理
        </h1>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 py-2 px-2">
        {navItems.map((item) => {
          const isActive = currentNav === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => setCurrentNav(item.id)}
              className={`
                w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm
                transition-colors duration-150 titlebar-no-drag
                ${
                  theme === 'hacker'
                    ? isActive
                      ? 'bg-hacker-primary/20 text-hacker-primary'
                      : 'text-hacker-text-dim hover:text-hacker-primary hover:bg-hacker-primary/10'
                    : ''
                }
                ${
                  theme === 'claude'
                    ? isActive
                      ? 'bg-claude-primary/10 text-claude-primary'
                      : 'text-claude-text-dim hover:text-claude-text-main hover:bg-black/5'
                    : ''
                }
                ${
                  theme === 'notion'
                    ? isActive
                      ? 'bg-notion-primary/10 text-notion-primary'
                      : 'text-notion-text-dim hover:text-notion-text-main hover:bg-black/5'
                    : ''
                }
              `}
            >
              <Icon className="w-5 h-5" />
              <span className={theme === 'hacker' ? 'font-mono text-xs' : ''}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* 底部版本信息 */}
      <div
        className={`
          px-4 py-3 border-t text-xs
          ${theme === 'hacker' ? 'border-hacker-border text-hacker-text-dim font-mono' : ''}
          ${theme === 'claude' ? 'border-claude-border text-claude-text-dim' : ''}
          ${theme === 'notion' ? 'border-notion-border text-notion-text-dim' : ''}
        `}
      >
        v0.1.0
      </div>
    </aside>
  );
};
