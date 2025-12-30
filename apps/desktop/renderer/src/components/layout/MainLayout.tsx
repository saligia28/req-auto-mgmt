import type { FC, ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { useAppStore } from '@/stores/appStore';

interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout: FC<MainLayoutProps> = ({ children }) => {
  const { settings } = useAppStore();
  const theme = settings.theme;

  return (
    <div
      className={`
        h-screen flex overflow-hidden
        ${theme === 'hacker' ? 'bg-hacker-bg' : ''}
        ${theme === 'claude' ? 'bg-claude-bg' : ''}
        ${theme === 'notion' ? 'bg-notion-bg' : ''}
      `}
      data-theme={theme}
    >
      {/* 侧边栏 */}
      <Sidebar />

      {/* 主内容区 */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* 标题栏拖拽区域 (macOS) */}
        <div className="h-10 titlebar-drag flex-shrink-0" />

        {/* 内容区域 */}
        <div className="flex-1 overflow-auto p-6">{children}</div>
      </main>
    </div>
  );
};
