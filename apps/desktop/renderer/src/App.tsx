import { useEffect, type FC } from 'react';
import { MainLayout } from './components/layout';
import { RequirementsPage } from './components/requirements';
import { TerminalPage } from './components/terminal';
import { SettingsPage } from './components/settings';
import { useAppStore } from './stores/appStore';

const App: FC = () => {
  const { currentNav, initialized, initializeSettings } = useAppStore();

  // 应用启动时从主进程加载设置
  useEffect(() => {
    initializeSettings();
  }, [initializeSettings]);

  // 等待设置加载完成
  if (!initialized) {
    return (
      <div className="h-screen flex items-center justify-center bg-claude-bg">
        <div className="text-claude-text-dim">Loading...</div>
      </div>
    );
  }

  const renderPage = () => {
    switch (currentNav) {
      case 'requirements':
        return <RequirementsPage />;
      case 'terminal':
        return <TerminalPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <RequirementsPage />;
    }
  };

  return <MainLayout>{renderPage()}</MainLayout>;
};

export default App;
