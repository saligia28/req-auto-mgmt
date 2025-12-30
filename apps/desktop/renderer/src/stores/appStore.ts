import { create } from 'zustand';
import type { NavItem, AppSettings, PathConfig } from '@req-auto-mgmt/shared-types';

// 缓存key
const NAV_CACHE_KEY = 'req-mgmt:current-nav';

// 有效的导航项
const validNavItems: NavItem[] = ['requirements', 'terminal', 'settings'];

// 从缓存读取导航状态
function getCachedNav(): NavItem {
  try {
    const cached = localStorage.getItem(NAV_CACHE_KEY);
    if (cached && validNavItems.includes(cached as NavItem)) {
      return cached as NavItem;
    }
  } catch {
    // localStorage 不可用时忽略
  }
  return 'requirements';
}

// 默认设置
const defaultSettings: AppSettings = {
  paths: {
    requirementsDir: '',
    projects: [],
  },
  tapd: {
    apiBase: 'https://api.tapd.cn',
    workspaceId: '',
  },
  ai: {
    provider: 'ollama',
    ollama: {
      baseUrl: 'http://localhost:11434',
      model: 'gpt-oss:20b',
    },
  },
  notification: {
    enabled: false,
    webhookUrl: '',
  },
  theme: 'claude',
};

// 应用状态
interface AppState {
  // 初始化状态
  initialized: boolean;
  initializeSettings: () => Promise<void>;

  // 导航
  currentNav: NavItem;
  setCurrentNav: (nav: NavItem) => void;

  // 设置
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;

  // 路径配置
  addProject: (project: PathConfig) => void;
  updateProject: (id: string, project: Partial<PathConfig>) => void;
  removeProject: (id: string) => void;

  // 主题
  setTheme: (theme: AppSettings['theme']) => void;
}

export const useAppStore = create<AppState>()((set, get) => ({
  // 初始化状态
  initialized: false,

  // 从主进程加载设置
  initializeSettings: async () => {
    if (get().initialized) return;

    try {
      const mainSettings = await window.electronAPI.settings.getAll();
      if (mainSettings) {
        set({
          settings: mainSettings as AppSettings,
          initialized: true,
        });
      } else {
        set({ initialized: true });
      }
    } catch (err) {
      console.error('Failed to load settings from main process:', err);
      set({ initialized: true });
    }
  },

  // 导航状态 - 从缓存读取
  currentNav: getCachedNav(),
  setCurrentNav: (nav) => {
    set({ currentNav: nav });
    try {
      localStorage.setItem(NAV_CACHE_KEY, nav);
    } catch {
      // localStorage 不可用时忽略
    }
  },

  // 设置状态 - 同步到主进程
  settings: defaultSettings,
  updateSettings: (newSettings) => {
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    }));
    // 同步到主进程
    window.electronAPI.settings.update(newSettings).catch((err) => {
      console.error('Failed to sync settings to main process:', err);
    });
  },

  // 路径配置 - 同步到主进程
  addProject: (project) => {
    set((state) => ({
      settings: {
        ...state.settings,
        paths: {
          ...state.settings.paths,
          projects: [...state.settings.paths.projects, project],
        },
      },
    }));
    window.electronAPI.settings.addProject(project).catch((err) => {
      console.error('Failed to add project to main process:', err);
    });
  },

  updateProject: (id, updates) => {
    set((state) => ({
      settings: {
        ...state.settings,
        paths: {
          ...state.settings.paths,
          projects: state.settings.paths.projects.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        },
      },
    }));
    window.electronAPI.settings.updateProject(id, updates).catch((err) => {
      console.error('Failed to update project in main process:', err);
    });
  },

  removeProject: (id) => {
    set((state) => ({
      settings: {
        ...state.settings,
        paths: {
          ...state.settings.paths,
          projects: state.settings.paths.projects.filter((p) => p.id !== id),
        },
      },
    }));
    window.electronAPI.settings.removeProject(id).catch((err) => {
      console.error('Failed to remove project from main process:', err);
    });
  },

  // 主题 - 同步到主进程
  setTheme: (theme) => {
    set((state) => ({
      settings: { ...state.settings, theme },
    }));
    window.electronAPI.settings.setTheme(theme).catch((err) => {
      console.error('Failed to set theme in main process:', err);
    });
  },
}));
