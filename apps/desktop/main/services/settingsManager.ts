/**
 * Settings Manager
 * Manages application settings persistence
 * Supports both JSON config and .env file sync
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

// 应用设置类型
export interface AppSettings {
  paths: {
    requirementsDir: string;
    projects: Array<{
      id: string;
      label: string;
      path: string;
    }>;
  };
  tapd: {
    apiBase: string;
    workspaceId: string;
    token?: string;
    username?: string;
    password?: string;
  };
  ai: {
    provider: 'ollama' | 'deepseek';
    ollama?: {
      baseUrl: string;
      model: string;
    };

    deepseek?: {
      apiKey: string;
      baseUrl?: string;
      model: string;
    };
  };
  notification: {
    enabled: boolean;
    webhookUrl: string;
  };
  theme: 'claude' | 'notion' | 'hacker';
}

// .env 文件中支持的配置映射
const ENV_MAPPINGS: Record<
  string,
  { path: string[]; type: 'string' | 'number' | 'boolean' | 'json' }
> = {
  // TAPD 配置
  TAPD_API_BASE: { path: ['tapd', 'apiBase'], type: 'string' },
  TAPD_WORKSPACE_ID: { path: ['tapd', 'workspaceId'], type: 'string' },
  TAPD_TOKEN: { path: ['tapd', 'token'], type: 'string' },
  TAPD_USERNAME: { path: ['tapd', 'username'], type: 'string' },
  TAPD_PASSWORD: { path: ['tapd', 'password'], type: 'string' },
  // AI 配置
  AI_PROVIDER: { path: ['ai', 'provider'], type: 'string' },
  OLLAMA_BASE_URL: { path: ['ai', 'ollama', 'baseUrl'], type: 'string' },
  OLLAMA_MODEL: { path: ['ai', 'ollama', 'model'], type: 'string' },
  DEEPSEEK_API_KEY: { path: ['ai', 'deepseek', 'apiKey'], type: 'string' },
  DEEPSEEK_BASE_URL: { path: ['ai', 'deepseek', 'baseUrl'], type: 'string' },
  DEEPSEEK_MODEL: { path: ['ai', 'deepseek', 'model'], type: 'string' },
  // Notion 配置
  NOTION_TOKEN: { path: ['notion', 'token'], type: 'string' },
  NOTION_DATABASE_ID: { path: ['notion', 'databaseId'], type: 'string' },
  // 路径配置
  REQUIREMENTS_DIR: { path: ['paths', 'requirementsDir'], type: 'string' },
  // 主题
  APP_THEME: { path: ['theme'], type: 'string' },
};

// 默认设置
const defaultSettings: AppSettings = {
  paths: {
    requirementsDir: '',
    projects: [],
  },
  tapd: {
    apiBase: 'https://api.tapd.cn',
    workspaceId: '',
    token: '',
    username: '',
    password: '',
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

class SettingsManager {
  private settings: AppSettings;
  private configPath: string;
  private envPath: string;
  private initialized = false;

  constructor() {
    this.settings = { ...defaultSettings };
    this.configPath = '';
    this.envPath = '';
  }

  /**
   * 初始化设置管理器
   */
  init(): void {
    if (this.initialized) return;

    const userDataPath = app.getPath('userData');
    const configDir = path.join(userDataPath, 'config');

    // 确保配置目录存在
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    this.configPath = path.join(configDir, 'settings.json');
    this.envPath = path.join(configDir, '.env');

    // 先加载 JSON 配置
    this.load();

    // 然后从 .env 文件加载并覆盖（.env 优先级更高）
    this.loadFromEnv();

    // 同步写入 .env 文件（确保文件存在）
    this.syncToEnv();

    this.initialized = true;

    console.log('[SettingsManager] Initialized');
    console.log('[SettingsManager] Config path:', this.configPath);
    console.log('[SettingsManager] Env path:', this.envPath);
  }

  /**
   * 从 .env 文件加载配置
   */
  private loadFromEnv(): void {
    try {
      // 优先检查用户数据目录的 .env
      let envContent = '';

      if (fs.existsSync(this.envPath)) {
        envContent = fs.readFileSync(this.envPath, 'utf-8');
        console.log('[SettingsManager] Loading from user .env file');
      } else {
        // 如果用户目录没有，尝试加载项目根目录的 .env（开发环境）
        const projectEnvPath = path.join(process.cwd(), '.env');
        if (fs.existsSync(projectEnvPath)) {
          envContent = fs.readFileSync(projectEnvPath, 'utf-8');
          console.log('[SettingsManager] Loading from project .env file');
        }
      }

      if (!envContent) return;

      const envValues = this.parseEnvFile(envContent);

      // 将 .env 值应用到设置
      for (const [key, mapping] of Object.entries(ENV_MAPPINGS)) {
        if (envValues[key] !== undefined && envValues[key] !== '') {
          this.setNestedValue(
            this.settings as unknown as Record<string, unknown>,
            mapping.path,
            envValues[key],
            mapping.type
          );
        }
      }

      console.log('[SettingsManager] Loaded settings from .env');
    } catch (err) {
      console.error('[SettingsManager] Failed to load from .env:', err);
    }
  }

  /**
   * 解析 .env 文件内容
   */
  private parseEnvFile(content: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      // 跳过空行和注释
      if (!trimmed || trimmed.startsWith('#')) continue;

      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;

      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();

      // 去除引号
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      result[key] = value;
    }

    return result;
  }

  /**
   * 设置嵌套对象的值
   */
  private setNestedValue(
    obj: Record<string, unknown>,
    path: string[],
    value: string,
    type: 'string' | 'number' | 'boolean' | 'json'
  ): void {
    let current: Record<string, unknown> = obj;

    for (let i = 0; i < path.length - 1; i++) {
      if (current[path[i]] === undefined) {
        current[path[i]] = {};
      }
      current = current[path[i]] as Record<string, unknown>;
    }

    const lastKey = path[path.length - 1];

    switch (type) {
      case 'number':
        current[lastKey] = parseFloat(value) || 0;
        break;
      case 'boolean':
        current[lastKey] = value === 'true' || value === '1';
        break;
      case 'json':
        try {
          current[lastKey] = JSON.parse(value);
        } catch {
          current[lastKey] = value;
        }
        break;
      default:
        current[lastKey] = value;
    }
  }

  /**
   * 获取嵌套对象的值
   */
  private getNestedValue(obj: Record<string, unknown>, path: string[]): unknown {
    let current: unknown = obj;

    for (const key of path) {
      if (current === undefined || current === null) return undefined;
      current = (current as Record<string, unknown>)[key];
    }

    return current;
  }

  /**
   * 同步设置到 .env 文件
   */
  syncToEnv(): void {
    try {
      const lines: string[] = [
        '# ===========================================',
        '# 需求自动化管理系统 - 用户配置',
        '# 此文件由应用自动管理，修改后重启生效',
        '# ===========================================',
        '',
      ];

      // 分组写入配置
      const groups: Record<string, string[]> = {
        'TAPD 配置': [
          'TAPD_API_BASE',
          'TAPD_WORKSPACE_ID',
          'TAPD_TOKEN',
          'TAPD_USERNAME',
          'TAPD_PASSWORD',
        ],
        'AI 配置': [
          'AI_PROVIDER',
          'OLLAMA_BASE_URL',
          'OLLAMA_MODEL',
          'DEEPSEEK_API_KEY',
          'DEEPSEEK_BASE_URL',
          'DEEPSEEK_MODEL',
        ],
        'Notion 配置': ['NOTION_TOKEN', 'NOTION_DATABASE_ID'],
        路径配置: ['REQUIREMENTS_DIR'],
        应用配置: ['APP_THEME'],
      };

      for (const [groupName, keys] of Object.entries(groups)) {
        lines.push(`# -------------------------------------------`);
        lines.push(`# ${groupName}`);
        lines.push(`# -------------------------------------------`);

        for (const key of keys) {
          const mapping = ENV_MAPPINGS[key];
          if (mapping) {
            const value = this.getNestedValue(
              this.settings as unknown as Record<string, unknown>,
              mapping.path
            );
            const strValue = value !== undefined && value !== null ? String(value) : '';
            lines.push(`${key}=${strValue}`);
          }
        }
        lines.push('');
      }

      fs.writeFileSync(this.envPath, lines.join('\n'), 'utf-8');
      console.log('[SettingsManager] Synced settings to .env');
    } catch (err) {
      console.error('[SettingsManager] Failed to sync to .env:', err);
    }
  }

  /**
   * 获取 .env 文件路径
   */
  getEnvPath(): string {
    return this.envPath;
  }

  /**
   * 加载设置
   */
  private load(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        const loaded = JSON.parse(content);
        this.settings = this.mergeSettings(defaultSettings, loaded);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
      this.settings = { ...defaultSettings };
    }
  }

  /**
   * 合并设置（保留默认值结构）
   */
  private mergeSettings(defaults: AppSettings, loaded: Partial<AppSettings>): AppSettings {
    return {
      paths: {
        ...defaults.paths,
        ...loaded.paths,
      },
      tapd: {
        ...defaults.tapd,
        ...loaded.tapd,
      },
      ai: {
        ...defaults.ai,
        ...loaded.ai,
        ollama: loaded.ai?.ollama
          ? {
              ...defaults.ai.ollama,
              ...loaded.ai.ollama,
            }
          : defaults.ai.ollama,
        deepseek: loaded.ai?.deepseek,
      },
      notification: {
        ...defaults.notification,
        ...loaded.notification,
      },
      theme: loaded.theme || defaults.theme,
    };
  }

  /**
   * 保存设置
   */
  save(): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.settings, null, 2), 'utf-8');
      // 同时同步到 .env 文件
      this.syncToEnv();
    } catch (err) {
      console.error('Failed to save settings:', err);
      throw err;
    }
  }

  /**
   * 获取所有设置
   */
  getAll(): AppSettings {
    return { ...this.settings };
  }

  /**
   * 更新设置
   */
  update(updates: Partial<AppSettings>): void {
    this.settings = this.mergeSettings(this.settings, updates);
    this.save();
  }

  /**
   * 获取 TAPD 配置
   */
  getTapdConfig() {
    return { ...this.settings.tapd };
  }

  /**
   * 更新 TAPD 配置
   */
  updateTapdConfig(config: Partial<AppSettings['tapd']>): void {
    this.settings.tapd = { ...this.settings.tapd, ...config };
    this.save();
  }

  /**
   * 获取主题
   */
  getTheme(): AppSettings['theme'] {
    return this.settings.theme;
  }

  /**
   * 设置主题
   */
  setTheme(theme: AppSettings['theme']): void {
    this.settings.theme = theme;
    this.save();
  }

  /**
   * 获取项目列表
   */
  getProjects() {
    return [...this.settings.paths.projects];
  }

  /**
   * 添加项目
   */
  addProject(project: { id: string; label: string; path: string }): void {
    this.settings.paths.projects.push(project);
    this.save();
  }

  /**
   * 更新项目
   */
  updateProject(id: string, updates: Partial<{ label: string; path: string }>): void {
    const index = this.settings.paths.projects.findIndex((p) => p.id === id);
    if (index !== -1) {
      this.settings.paths.projects[index] = {
        ...this.settings.paths.projects[index],
        ...updates,
      };
      this.save();
    }
  }

  /**
   * 删除项目
   */
  removeProject(id: string): void {
    this.settings.paths.projects = this.settings.paths.projects.filter((p) => p.id !== id);
    this.save();
  }
}

// 单例
export const settingsManager = new SettingsManager();
