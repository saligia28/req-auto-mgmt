import { FC, useState, useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import type { AppSettings, PathConfig, AIModelConfig } from '@req-auto-mgmt/shared-types';

// Prompt 模板类型
interface PromptTemplate {
  id: string;
  name: string;
  template: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt?: string;
}

export const SettingsPage: FC = () => {
  const { settings, setTheme, updateSettings, addProject, updateProject, removeProject } =
    useAppStore();
  const theme = settings.theme;

  // TAPD 配置状态
  const [tapdConfig, setTapdConfig] = useState({
    apiBase: settings.tapd.apiBase || 'https://api.tapd.cn',
    workspaceId: settings.tapd.workspaceId || '',
    token: settings.tapd.token || '',
    username: settings.tapd.username || '',
    password: settings.tapd.password || '',
  });
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [connectionMessage, setConnectionMessage] = useState('');

  // 需求文件目录
  const [requirementsDir, setRequirementsDir] = useState(settings.paths.requirementsDir || '');

  // 项目路径编辑状态
  const [editingProject, setEditingProject] = useState<PathConfig | null>(null);
  const [newProjectLabel, setNewProjectLabel] = useState('');
  const [newProjectPath, setNewProjectPath] = useState('');

  // AI 配置状态
  const [aiConfig, setAiConfig] = useState<AIModelConfig>({
    provider: settings.ai.provider || 'ollama',
    ollama: {
      baseUrl: settings.ai.ollama?.baseUrl || 'http://localhost:11434',
      model: settings.ai.ollama?.model || 'gpt-oss:20b',
    },
    deepseek: {
      apiKey: settings.ai.deepseek?.apiKey || '',
      baseUrl: settings.ai.deepseek?.baseUrl || 'https://api.deepseek.com',
      model: settings.ai.deepseek?.model || 'deepseek-chat',
    },
  });
  const [testingAIConnection, setTestingAIConnection] = useState(false);
  const [aiConnectionStatus, setAIConnectionStatus] = useState<'idle' | 'success' | 'error'>(
    'idle'
  );
  const [aiConnectionMessage, setAIConnectionMessage] = useState('');

  // Prompt 管理状态
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<PromptTemplate | null>(null);
  const [newPromptName, setNewPromptName] = useState('');
  const [newPromptTemplate, setNewPromptTemplate] = useState('');
  const [promptSaving, setPromptSaving] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);

  const themes: { id: AppSettings['theme']; label: string; description: string }[] = [
    { id: 'claude', label: 'Claude', description: '温暖的米色调，简洁优雅' },
    { id: 'notion', label: 'Notion', description: '清爽的白色调，专业商务' },
    { id: 'hacker', label: 'Hacker', description: '深色终端风格，极客范' },
  ];

  // 加载 Prompts
  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    setPromptsLoading(true);
    setPromptError(null);
    try {
      const result = await window.electronAPI.ai.getPrompts();
      if (result.success && result.prompts) {
        setPrompts(result.prompts);
      } else {
        setPromptError(result.error || 'Failed to load prompts');
      }
    } catch (err) {
      setPromptError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setPromptsLoading(false);
    }
  };

  // 创建 Prompt
  const handleCreatePrompt = async () => {
    if (!newPromptName.trim() || !newPromptTemplate.trim()) return;

    setPromptSaving(true);
    setPromptError(null);
    try {
      const result = await window.electronAPI.ai.createPrompt({
        name: newPromptName.trim(),
        template: newPromptTemplate.trim(),
      });
      if (result.success) {
        setNewPromptName('');
        setNewPromptTemplate('');
        loadPrompts();
      } else {
        setPromptError(result.error || 'Failed to create prompt');
      }
    } catch (err) {
      setPromptError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setPromptSaving(false);
    }
  };

  // 更新 Prompt
  const handleUpdatePrompt = async () => {
    if (!editingPrompt || !newPromptName.trim() || !newPromptTemplate.trim()) return;

    setPromptSaving(true);
    setPromptError(null);
    try {
      const result = await window.electronAPI.ai.updatePrompt(editingPrompt.id, {
        name: newPromptName.trim(),
        template: newPromptTemplate.trim(),
      });
      if (result.success) {
        setEditingPrompt(null);
        setNewPromptName('');
        setNewPromptTemplate('');
        loadPrompts();
      } else {
        setPromptError(result.error || 'Failed to update prompt');
      }
    } catch (err) {
      setPromptError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setPromptSaving(false);
    }
  };

  // 删除 Prompt
  const handleDeletePrompt = async (id: string) => {
    if (!confirm('确认删除此模板？')) return;

    try {
      const result = await window.electronAPI.ai.deletePrompt(id);
      if (result.success) {
        loadPrompts();
      } else {
        setPromptError(result.error || 'Failed to delete prompt');
      }
    } catch (err) {
      setPromptError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // 开始编辑 Prompt
  const startEditPrompt = (prompt: PromptTemplate) => {
    setEditingPrompt(prompt);
    setNewPromptName(prompt.name);
    setNewPromptTemplate(prompt.template);
  };

  // 取消编辑 Prompt
  const cancelEditPrompt = () => {
    setEditingPrompt(null);
    setNewPromptName('');
    setNewPromptTemplate('');
  };

  // 保存 TAPD 配置
  const handleSaveTapdConfig = async () => {
    updateSettings({
      tapd: tapdConfig,
    });
    // 同步到主进程
    await window.electronAPI.settings.updateTapdConfig(tapdConfig);
    setConnectionStatus('idle');
  };

  // 测试 TAPD 连接
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus('idle');
    setConnectionMessage('');

    try {
      // 先保存配置
      await window.electronAPI.settings.updateTapdConfig(tapdConfig);
      // 测试连接
      const result = await window.electronAPI.tapd.testConnection();
      if (result.success) {
        setConnectionStatus('success');
        setConnectionMessage('连接成功');
      } else {
        setConnectionStatus('error');
        setConnectionMessage(result.error || '连接失败');
      }
    } catch (err) {
      setConnectionStatus('error');
      setConnectionMessage(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setTestingConnection(false);
    }
  };

  // 保存需求目录
  const handleSaveRequirementsDir = () => {
    updateSettings({
      paths: {
        ...settings.paths,
        requirementsDir,
      },
    });
  };

  // 选择需求目录
  const handleSelectRequirementsDir = async () => {
    try {
      const result = await window.electronAPI.dialog.selectDirectory({
        title: '选择需求文件目录',
        defaultPath: requirementsDir || undefined,
      });
      if (result.success && result.path) {
        setRequirementsDir(result.path);
        // 自动保存
        updateSettings({
          paths: {
            ...settings.paths,
            requirementsDir: result.path,
          },
        });
      }
    } catch (err) {
      console.error('Failed to select directory:', err);
    }
  };

  // 添加项目
  const handleAddProject = () => {
    if (!newProjectLabel.trim() || !newProjectPath.trim()) return;

    // 检查重复
    if (settings.paths.projects.some((p) => p.label === newProjectLabel.trim())) {
      alert('标签名称已存在');
      return;
    }
    if (settings.paths.projects.some((p) => p.path === newProjectPath.trim())) {
      alert('路径已存在');
      return;
    }

    addProject({
      id: Date.now().toString(),
      label: newProjectLabel.trim(),
      path: newProjectPath.trim(),
    });
    setNewProjectLabel('');
    setNewProjectPath('');
  };

  // 选择项目路径
  const handleSelectProjectPath = async (isEditing: boolean) => {
    try {
      const result = await window.electronAPI.dialog.selectDirectory({
        title: '选择项目目录',
        defaultPath: isEditing ? newProjectPath : undefined,
      });
      if (result.success && result.path) {
        setNewProjectPath(result.path);
        // 如果标签为空，自动使用文件夹名称
        if (!newProjectLabel.trim()) {
          const folderName = result.path.split('/').pop() || result.path.split('\\').pop() || '';
          setNewProjectLabel(folderName);
        }
      }
    } catch (err) {
      console.error('Failed to select project directory:', err);
    }
  };

  // 更新项目
  const handleUpdateProject = () => {
    if (!editingProject || !newProjectLabel.trim() || !newProjectPath.trim()) return;

    // 检查重复（排除当前项）
    if (
      settings.paths.projects.some(
        (p) => p.id !== editingProject.id && p.label === newProjectLabel.trim()
      )
    ) {
      alert('标签名称已存在');
      return;
    }
    if (
      settings.paths.projects.some(
        (p) => p.id !== editingProject.id && p.path === newProjectPath.trim()
      )
    ) {
      alert('路径已存在');
      return;
    }

    updateProject(editingProject.id, {
      label: newProjectLabel.trim(),
      path: newProjectPath.trim(),
    });
    setEditingProject(null);
    setNewProjectLabel('');
    setNewProjectPath('');
  };

  // 开始编辑项目
  const startEditProject = (project: PathConfig) => {
    setEditingProject(project);
    setNewProjectLabel(project.label);
    setNewProjectPath(project.path);
  };

  // 取消编辑
  const cancelEdit = () => {
    setEditingProject(null);
    setNewProjectLabel('');
    setNewProjectPath('');
  };

  // 删除项目
  const handleDeleteProject = (id: string) => {
    if (confirm('确认删除此项目路径？')) {
      removeProject(id);
    }
  };

  // 保存 AI 配置
  const handleSaveAIConfig = async () => {
    updateSettings({
      ai: aiConfig,
    });
    // 同步到 AI 服务
    try {
      if (window.electronAPI?.ai?.updateConfig) {
        await window.electronAPI.ai.updateConfig(aiConfig);
      }
    } catch (err) {
      console.warn('Failed to sync AI config:', err);
    }
    setAIConnectionStatus('idle');
  };

  // 测试 AI 连接
  const handleTestAIConnection = async () => {
    setTestingAIConnection(true);
    setAIConnectionStatus('idle');
    setAIConnectionMessage('');

    try {
      // 先保存配置
      await handleSaveAIConfig();
      // 测试连接
      if (window.electronAPI?.ai?.testConnection) {
        const result = await window.electronAPI.ai.testConnection();
        if (result.success) {
          setAIConnectionStatus('success');
          setAIConnectionMessage(`连接成功${result.latency ? ` (${result.latency}ms)` : ''}`);
        } else {
          setAIConnectionStatus('error');
          setAIConnectionMessage(result.error || '连接失败');
        }
      } else {
        // 如果 API 未实现，模拟测试
        setAIConnectionStatus('success');
        setAIConnectionMessage('配置已保存');
      }
    } catch (err) {
      setAIConnectionStatus('error');
      setAIConnectionMessage(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setTestingAIConnection(false);
    }
  };

  // 输入框样式
  const inputClass = `
    w-full px-3 py-2 rounded-md text-sm
    ${theme === 'hacker' ? 'bg-hacker-bg border border-hacker-border text-hacker-text-main font-mono focus:border-hacker-primary' : ''}
    ${theme === 'claude' ? 'bg-claude-bg border border-claude-border text-claude-text-main focus:border-claude-primary' : ''}
    ${theme === 'notion' ? 'bg-notion-bg border border-notion-border text-notion-text-main focus:border-notion-primary' : ''}
    outline-none transition-colors
  `;

  const buttonPrimaryClass = `
    px-4 py-2 rounded-md text-sm transition-colors
    ${theme === 'hacker' ? 'bg-hacker-primary text-black hover:bg-hacker-primary/80 font-mono' : ''}
    ${theme === 'claude' ? 'bg-claude-primary text-white hover:bg-claude-primary/90' : ''}
    ${theme === 'notion' ? 'bg-notion-primary text-white hover:bg-notion-primary/90' : ''}
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  const buttonSecondaryClass = `
    px-4 py-2 rounded-md text-sm transition-colors
    ${theme === 'hacker' ? 'border border-hacker-border text-hacker-text-dim hover:border-hacker-primary hover:text-hacker-primary font-mono' : ''}
    ${theme === 'claude' ? 'border border-claude-border text-claude-text-dim hover:border-claude-primary hover:text-claude-primary' : ''}
    ${theme === 'notion' ? 'border border-notion-border text-notion-text-dim hover:border-notion-primary hover:text-notion-primary' : ''}
  `;

  const labelClass = `
    block text-sm mb-1
    ${theme === 'hacker' ? 'text-hacker-text-dim font-mono' : ''}
    ${theme === 'claude' ? 'text-claude-text-dim' : ''}
    ${theme === 'notion' ? 'text-notion-text-dim' : ''}
  `;

  const sectionClass = `
    p-4 rounded-lg border mb-6
    ${theme === 'hacker' ? 'bg-hacker-panel border-hacker-border' : ''}
    ${theme === 'claude' ? 'bg-claude-panel border-claude-border' : ''}
    ${theme === 'notion' ? 'bg-notion-panel border-notion-border' : ''}
  `;

  const sectionTitleClass = `
    text-sm font-medium mb-4
    ${theme === 'hacker' ? 'text-hacker-primary font-mono uppercase' : ''}
    ${theme === 'claude' ? 'text-claude-text-main' : ''}
    ${theme === 'notion' ? 'text-notion-text-main' : ''}
  `;

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-2xl">
        <h2
          className={`
            text-xl font-semibold mb-6
            ${theme === 'hacker' ? 'text-hacker-primary font-mono' : ''}
            ${theme === 'claude' ? 'text-claude-text-main' : ''}
            ${theme === 'notion' ? 'text-notion-text-main' : ''}
          `}
        >
          {theme === 'hacker' ? '> SETTINGS' : '设置'}
        </h2>

        {/* 主题设置 */}
        <section className={sectionClass}>
          <h3 className={sectionTitleClass}>主题</h3>
          <div className="grid grid-cols-3 gap-3">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`
                  p-3 rounded-lg border text-left transition-all
                  ${
                    theme === 'hacker'
                      ? settings.theme === t.id
                        ? 'border-hacker-primary bg-hacker-primary/10'
                        : 'border-hacker-border hover:border-hacker-primary/50'
                      : ''
                  }
                  ${
                    theme === 'claude'
                      ? settings.theme === t.id
                        ? 'border-claude-primary bg-claude-primary/5'
                        : 'border-claude-border hover:border-claude-primary/50'
                      : ''
                  }
                  ${
                    theme === 'notion'
                      ? settings.theme === t.id
                        ? 'border-notion-primary bg-notion-primary/5'
                        : 'border-notion-border hover:border-notion-primary/50'
                      : ''
                  }
                `}
              >
                <div
                  className={`
                    text-sm font-medium
                    ${theme === 'hacker' ? 'text-hacker-primary font-mono' : ''}
                    ${theme === 'claude' ? 'text-claude-text-main' : ''}
                    ${theme === 'notion' ? 'text-notion-text-main' : ''}
                  `}
                >
                  {t.label}
                </div>
                <div
                  className={`
                    text-xs mt-1
                    ${theme === 'hacker' ? 'text-hacker-text-dim' : ''}
                    ${theme === 'claude' ? 'text-claude-text-dim' : ''}
                    ${theme === 'notion' ? 'text-notion-text-dim' : ''}
                  `}
                >
                  {t.description}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* TAPD 配置 */}
        <section className={sectionClass}>
          <h3 className={sectionTitleClass}>TAPD 配置</h3>

          <div className="space-y-4">
            <div>
              <label className={labelClass}>API 地址</label>
              <input
                type="text"
                value={tapdConfig.apiBase}
                onChange={(e) => setTapdConfig({ ...tapdConfig, apiBase: e.target.value })}
                placeholder="https://api.tapd.cn"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>工作区 ID</label>
              <input
                type="text"
                value={tapdConfig.workspaceId}
                onChange={(e) => setTapdConfig({ ...tapdConfig, workspaceId: e.target.value })}
                placeholder="12345678"
                className={inputClass}
              />
            </div>

            <div
              className={`
                p-3 rounded-md text-xs
                ${theme === 'hacker' ? 'bg-hacker-bg text-hacker-text-dim font-mono' : ''}
                ${theme === 'claude' ? 'bg-claude-bg text-claude-text-dim' : ''}
                ${theme === 'notion' ? 'bg-notion-bg text-notion-text-dim' : ''}
              `}
            >
              {theme === 'hacker'
                ? '// 认证方式：Token 或 用户名+密码（二选一）'
                : '认证方式：Token 或 用户名+密码（二选一）'}
            </div>

            <div>
              <label className={labelClass}>Token</label>
              <input
                type="password"
                value={tapdConfig.token}
                onChange={(e) => setTapdConfig({ ...tapdConfig, token: e.target.value })}
                placeholder="TAPD API Token"
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>用户名</label>
                <input
                  type="text"
                  value={tapdConfig.username}
                  onChange={(e) => setTapdConfig({ ...tapdConfig, username: e.target.value })}
                  placeholder="API 用户名"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>密码</label>
                <input
                  type="password"
                  value={tapdConfig.password}
                  onChange={(e) => setTapdConfig({ ...tapdConfig, password: e.target.value })}
                  placeholder="API 密码"
                  className={inputClass}
                />
              </div>
            </div>

            {/* 连接状态 */}
            {connectionStatus !== 'idle' && (
              <div
                className={`
                  p-2 rounded text-sm
                  ${
                    connectionStatus === 'success'
                      ? theme === 'hacker'
                        ? 'bg-green-900/30 text-green-400'
                        : 'bg-green-50 text-green-600'
                      : theme === 'hacker'
                        ? 'bg-red-900/30 text-red-400'
                        : 'bg-red-50 text-red-600'
                  }
                  ${theme === 'hacker' ? 'font-mono' : ''}
                `}
              >
                {connectionStatus === 'success' ? '✓ ' : '✗ '}
                {connectionMessage}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleTestConnection}
                disabled={testingConnection || !tapdConfig.workspaceId}
                className={buttonSecondaryClass}
              >
                {testingConnection ? '测试中...' : '测试连接'}
              </button>
              <button onClick={handleSaveTapdConfig} className={buttonPrimaryClass}>
                保存配置
              </button>
            </div>
          </div>
        </section>

        {/* 需求文件目录 */}
        <section className={sectionClass}>
          <h3 className={sectionTitleClass}>需求文件目录</h3>

          <div className="space-y-4">
            <div>
              <label className={labelClass}>存储路径</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={requirementsDir}
                  onChange={(e) => setRequirementsDir(e.target.value)}
                  placeholder="例如: /Users/xxx/TAPDFeature"
                  className={`${inputClass} flex-1`}
                  readOnly
                />
                <button onClick={handleSelectRequirementsDir} className={buttonSecondaryClass}>
                  选择目录
                </button>
              </div>
              <p
                className={`
                  text-xs mt-1
                  ${theme === 'hacker' ? 'text-hacker-text-dim font-mono' : ''}
                  ${theme === 'claude' ? 'text-claude-text-dim' : ''}
                  ${theme === 'notion' ? 'text-notion-text-dim' : ''}
                `}
              >
                需求 Markdown 文件将保存到此目录
              </p>
            </div>

            {requirementsDir && (
              <button onClick={handleSaveRequirementsDir} className={buttonPrimaryClass}>
                保存
              </button>
            )}
          </div>
        </section>

        {/* 项目路径配置 */}
        <section className={sectionClass}>
          <h3 className={sectionTitleClass}>项目路径</h3>

          <div className="space-y-4">
            {/* 现有项目列表 */}
            {settings.paths.projects.length > 0 && (
              <div className="space-y-2">
                {settings.paths.projects.map((project) => (
                  <div
                    key={project.id}
                    className={`
                      p-3 rounded-md border
                      ${theme === 'hacker' ? 'bg-hacker-bg border-hacker-border' : ''}
                      ${theme === 'claude' ? 'bg-claude-bg border-claude-border' : ''}
                      ${theme === 'notion' ? 'bg-notion-bg border-notion-border' : ''}
                    `}
                  >
                    {editingProject?.id === project.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={newProjectLabel}
                          onChange={(e) => setNewProjectLabel(e.target.value)}
                          placeholder="项目名称"
                          className={inputClass}
                        />
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newProjectPath}
                            onChange={(e) => setNewProjectPath(e.target.value)}
                            placeholder="/path/to/project"
                            className={`${inputClass} flex-1`}
                            readOnly
                          />
                          <button
                            onClick={() => handleSelectProjectPath(true)}
                            className={buttonSecondaryClass}
                          >
                            选择
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleUpdateProject}
                            disabled={!newProjectLabel.trim() || !newProjectPath.trim()}
                            className={buttonPrimaryClass}
                          >
                            保存
                          </button>
                          <button onClick={cancelEdit} className={buttonSecondaryClass}>
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center">
                        <div>
                          <div
                            className={`
                              text-sm font-medium
                              ${theme === 'hacker' ? 'text-hacker-primary font-mono' : ''}
                              ${theme === 'claude' ? 'text-claude-text-main' : ''}
                              ${theme === 'notion' ? 'text-notion-text-main' : ''}
                            `}
                          >
                            {project.label}
                          </div>
                          <div
                            className={`
                              text-xs truncate max-w-[400px]
                              ${theme === 'hacker' ? 'text-hacker-text-dim font-mono' : ''}
                              ${theme === 'claude' ? 'text-claude-text-dim' : ''}
                              ${theme === 'notion' ? 'text-notion-text-dim' : ''}
                            `}
                          >
                            {project.path}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEditProject(project)}
                            className={`
                              px-2 py-1 text-xs rounded transition-colors
                              ${theme === 'hacker' ? 'text-hacker-text-dim hover:text-hacker-primary font-mono' : ''}
                              ${theme === 'claude' ? 'text-claude-text-dim hover:text-claude-primary' : ''}
                              ${theme === 'notion' ? 'text-notion-text-dim hover:text-notion-primary' : ''}
                            `}
                          >
                            编辑
                          </button>
                          <button
                            onClick={() => handleDeleteProject(project.id)}
                            className={`
                              px-2 py-1 text-xs rounded transition-colors
                              ${theme === 'hacker' ? 'text-red-400 hover:text-red-300 font-mono' : ''}
                              ${theme === 'claude' ? 'text-red-500 hover:text-red-600' : ''}
                              ${theme === 'notion' ? 'text-red-500 hover:text-red-600' : ''}
                            `}
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 添加新项目 */}
            {!editingProject && (
              <div
                className={`
                  p-3 rounded-md border border-dashed
                  ${theme === 'hacker' ? 'border-hacker-border' : ''}
                  ${theme === 'claude' ? 'border-claude-border' : ''}
                  ${theme === 'notion' ? 'border-notion-border' : ''}
                `}
              >
                <div className="space-y-3 mb-3">
                  <input
                    type="text"
                    value={newProjectLabel}
                    onChange={(e) => setNewProjectLabel(e.target.value)}
                    placeholder="项目名称"
                    className={inputClass}
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newProjectPath}
                      onChange={(e) => setNewProjectPath(e.target.value)}
                      placeholder="/path/to/project"
                      className={`${inputClass} flex-1`}
                      readOnly
                    />
                    <button
                      onClick={() => handleSelectProjectPath(false)}
                      className={buttonSecondaryClass}
                    >
                      {theme === 'hacker' ? 'BROWSE' : '选择目录'}
                    </button>
                  </div>
                </div>
                <button
                  onClick={handleAddProject}
                  disabled={!newProjectLabel.trim() || !newProjectPath.trim()}
                  className={buttonPrimaryClass}
                >
                  添加项目
                </button>
              </div>
            )}

            {settings.paths.projects.length === 0 && !editingProject && (
              <p
                className={`
                  text-sm text-center py-4
                  ${theme === 'hacker' ? 'text-hacker-text-dim font-mono' : ''}
                  ${theme === 'claude' ? 'text-claude-text-dim' : ''}
                  ${theme === 'notion' ? 'text-notion-text-dim' : ''}
                `}
              >
                暂无配置项目，请添加工作目录
              </p>
            )}
          </div>
        </section>

        {/* AI 配置 */}
        <section className={sectionClass}>
          <h3 className={sectionTitleClass}>AI 配置</h3>

          <div className="space-y-4">
            {/* 提供商选择 */}
            <div>
              <label className={labelClass}>AI 提供商</label>
              <div className="flex gap-4 mt-2">
                <label
                  className={`
                    flex items-center gap-2 cursor-pointer
                    ${theme === 'hacker' ? 'text-hacker-text-main font-mono' : ''}
                    ${theme === 'claude' ? 'text-claude-text-main' : ''}
                    ${theme === 'notion' ? 'text-notion-text-main' : ''}
                  `}
                >
                  <input
                    type="radio"
                    name="aiProvider"
                    value="ollama"
                    checked={aiConfig.provider === 'ollama'}
                    onChange={() => setAiConfig({ ...aiConfig, provider: 'ollama' })}
                    className={`
                      ${theme === 'hacker' ? 'accent-hacker-primary' : ''}
                      ${theme === 'claude' ? 'accent-claude-primary' : ''}
                      ${theme === 'notion' ? 'accent-notion-primary' : ''}
                    `}
                  />
                  Ollama (本地)
                </label>
                <label
                  className={`
                    flex items-center gap-2 cursor-pointer
                    ${theme === 'hacker' ? 'text-hacker-text-main font-mono' : ''}
                    ${theme === 'claude' ? 'text-claude-text-main' : ''}
                    ${theme === 'notion' ? 'text-notion-text-main' : ''}
                  `}
                >
                  <input
                    type="radio"
                    name="aiProvider"
                    value="deepseek"
                    checked={aiConfig.provider === 'deepseek'}
                    onChange={() => setAiConfig({ ...aiConfig, provider: 'deepseek' })}
                    className={`
                      ${theme === 'hacker' ? 'accent-hacker-primary' : ''}
                      ${theme === 'claude' ? 'accent-claude-primary' : ''}
                      ${theme === 'notion' ? 'accent-notion-primary' : ''}
                    `}
                  />
                  DeepSeek (云端)
                </label>
              </div>
            </div>

            {/* Ollama 配置 */}
            {aiConfig.provider === 'ollama' && (
              <div className="space-y-3">
                <div>
                  <label className={labelClass}>服务地址</label>
                  <input
                    type="text"
                    value={aiConfig.ollama?.baseUrl || ''}
                    onChange={(e) =>
                      setAiConfig({
                        ...aiConfig,
                        ollama: { ...aiConfig.ollama!, baseUrl: e.target.value },
                      })
                    }
                    placeholder="http://localhost:11434"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>模型名称</label>
                  <input
                    type="text"
                    value={aiConfig.ollama?.model || ''}
                    onChange={(e) =>
                      setAiConfig({
                        ...aiConfig,
                        ollama: { ...aiConfig.ollama!, model: e.target.value },
                      })
                    }
                    placeholder="gpt-oss:20b"
                    className={inputClass}
                  />
                  <p
                    className={`
                      text-xs mt-1
                      ${theme === 'hacker' ? 'text-hacker-text-dim font-mono' : ''}
                      ${theme === 'claude' ? 'text-claude-text-dim' : ''}
                      ${theme === 'notion' ? 'text-notion-text-dim' : ''}
                    `}
                  >
                    运行 ollama list 查看可用模型
                  </p>
                </div>
              </div>
            )}

            {/* DeepSeek 配置 */}
            {aiConfig.provider === 'deepseek' && (
              <div className="space-y-3">
                <div>
                  <label className={labelClass}>API Key</label>
                  <input
                    type="password"
                    value={aiConfig.deepseek?.apiKey || ''}
                    onChange={(e) =>
                      setAiConfig({
                        ...aiConfig,
                        deepseek: { ...aiConfig.deepseek!, apiKey: e.target.value },
                      })
                    }
                    placeholder={theme === 'hacker' ? 'sk-xxxxxxxxxxxxxxxx' : 'DeepSeek API Key'}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>模型</label>
                  <select
                    value={aiConfig.deepseek?.model || 'deepseek-chat'}
                    onChange={(e) =>
                      setAiConfig({
                        ...aiConfig,
                        deepseek: {
                          ...aiConfig.deepseek!,
                          model: e.target.value as 'deepseek-chat' | 'deepseek-reasoner',
                        },
                      })
                    }
                    className={inputClass}
                  >
                    <option value="deepseek-chat">deepseek-chat</option>
                    <option value="deepseek-coder">deepseek-coder</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>API 地址（可选）</label>
                  <input
                    type="text"
                    value={aiConfig.deepseek?.baseUrl || ''}
                    onChange={(e) =>
                      setAiConfig({
                        ...aiConfig,
                        deepseek: { ...aiConfig.deepseek!, baseUrl: e.target.value },
                      })
                    }
                    placeholder="https://api.deepseek.com"
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            {/* 连接状态 */}
            {aiConnectionStatus !== 'idle' && (
              <div
                className={`
                  p-2 rounded text-sm
                  ${
                    aiConnectionStatus === 'success'
                      ? theme === 'hacker'
                        ? 'bg-green-900/30 text-green-400'
                        : 'bg-green-50 text-green-600'
                      : theme === 'hacker'
                        ? 'bg-red-900/30 text-red-400'
                        : 'bg-red-50 text-red-600'
                  }
                  ${theme === 'hacker' ? 'font-mono' : ''}
                `}
              >
                {aiConnectionStatus === 'success' ? '✓ ' : '✗ '}
                {aiConnectionMessage}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleTestAIConnection}
                disabled={testingAIConnection}
                className={buttonSecondaryClass}
              >
                {testingAIConnection ? '测试中...' : '测试连接'}
              </button>
              <button onClick={handleSaveAIConfig} className={buttonPrimaryClass}>
                保存配置
              </button>
            </div>
          </div>
        </section>

        {/* Prompt 模板管理 */}
        <section className={sectionClass}>
          <h3 className={sectionTitleClass}>Prompt 模板</h3>

          <div className="space-y-4">
            {/* 加载状态 */}
            {promptsLoading && (
              <div
                className={`
                  text-sm text-center py-4
                  ${theme === 'hacker' ? 'text-hacker-text-dim font-mono' : ''}
                  ${theme === 'claude' ? 'text-claude-text-dim' : ''}
                  ${theme === 'notion' ? 'text-notion-text-dim' : ''}
                `}
              >
                加载中...
              </div>
            )}

            {/* 错误提示 */}
            {promptError && (
              <div
                className={`
                  p-2 rounded text-sm
                  ${theme === 'hacker' ? 'bg-red-900/30 text-red-400 font-mono' : 'bg-red-50 text-red-600'}
                `}
              >
                {promptError}
              </div>
            )}

            {/* Prompt 列表 */}
            {!promptsLoading && prompts.length > 0 && (
              <div className="space-y-2">
                {prompts.map((prompt) => (
                  <div
                    key={prompt.id}
                    className={`
                      p-3 rounded-md border
                      ${theme === 'hacker' ? 'bg-hacker-bg border-hacker-border' : ''}
                      ${theme === 'claude' ? 'bg-claude-bg border-claude-border' : ''}
                      ${theme === 'notion' ? 'bg-notion-bg border-notion-border' : ''}
                    `}
                  >
                    {editingPrompt?.id === prompt.id ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={newPromptName}
                          onChange={(e) => setNewPromptName(e.target.value)}
                          placeholder="模板名称"
                          className={inputClass}
                        />
                        <textarea
                          value={newPromptTemplate}
                          onChange={(e) => setNewPromptTemplate(e.target.value)}
                          placeholder={theme === 'hacker' ? 'PROMPT_CONTENT...' : '模板内容...'}
                          rows={6}
                          className={`${inputClass} resize-none font-mono text-xs`}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleUpdatePrompt}
                            disabled={
                              promptSaving || !newPromptName.trim() || !newPromptTemplate.trim()
                            }
                            className={buttonPrimaryClass}
                          >
                            {promptSaving ? '保存中...' : '保存'}
                          </button>
                          <button onClick={cancelEditPrompt} className={buttonSecondaryClass}>
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div
                              className={`
                                text-sm font-medium flex items-center gap-2
                                ${theme === 'hacker' ? 'text-hacker-primary font-mono' : ''}
                                ${theme === 'claude' ? 'text-claude-text-main' : ''}
                                ${theme === 'notion' ? 'text-notion-text-main' : ''}
                              `}
                            >
                              {prompt.name}
                              {prompt.isDefault && (
                                <span
                                  className={`
                                    text-xs px-1.5 py-0.5 rounded
                                    ${theme === 'hacker' ? 'bg-hacker-primary/20 text-hacker-primary' : ''}
                                    ${theme === 'claude' ? 'bg-claude-primary/10 text-claude-primary' : ''}
                                    ${theme === 'notion' ? 'bg-notion-primary/10 text-notion-primary' : ''}
                                  `}
                                >
                                  默认
                                </span>
                              )}
                            </div>
                            <div
                              className={`
                                text-xs mt-1
                                ${theme === 'hacker' ? 'text-hacker-text-dim font-mono' : ''}
                                ${theme === 'claude' ? 'text-claude-text-dim' : ''}
                                ${theme === 'notion' ? 'text-notion-text-dim' : ''}
                              `}
                            >
                              创建于 {new Date(prompt.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEditPrompt(prompt)}
                              className={`
                                px-2 py-1 text-xs rounded transition-colors
                                ${theme === 'hacker' ? 'text-hacker-text-dim hover:text-hacker-primary font-mono' : ''}
                                ${theme === 'claude' ? 'text-claude-text-dim hover:text-claude-primary' : ''}
                                ${theme === 'notion' ? 'text-notion-text-dim hover:text-notion-primary' : ''}
                              `}
                            >
                              编辑
                            </button>
                            {!prompt.isDefault && (
                              <button
                                onClick={() => handleDeletePrompt(prompt.id)}
                                className={`
                                  px-2 py-1 text-xs rounded transition-colors
                                  ${theme === 'hacker' ? 'text-red-400 hover:text-red-300 font-mono' : ''}
                                  ${theme === 'claude' ? 'text-red-500 hover:text-red-600' : ''}
                                  ${theme === 'notion' ? 'text-red-500 hover:text-red-600' : ''}
                                `}
                              >
                                删除
                              </button>
                            )}
                          </div>
                        </div>
                        <pre
                          className={`
                            text-xs p-2 rounded overflow-auto max-h-32
                            ${theme === 'hacker' ? 'bg-hacker-panel text-hacker-text-dim font-mono' : ''}
                            ${theme === 'claude' ? 'bg-claude-panel text-claude-text-dim' : ''}
                            ${theme === 'notion' ? 'bg-notion-panel text-notion-text-dim' : ''}
                          `}
                        >
                          {prompt.template}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 添加新模板 */}
            {!editingPrompt && (
              <div
                className={`
                  p-3 rounded-md border border-dashed
                  ${theme === 'hacker' ? 'border-hacker-border' : ''}
                  ${theme === 'claude' ? 'border-claude-border' : ''}
                  ${theme === 'notion' ? 'border-notion-border' : ''}
                `}
              >
                <div
                  className={`
                    text-sm font-medium mb-3
                    ${theme === 'hacker' ? 'text-hacker-text-dim font-mono' : ''}
                    ${theme === 'claude' ? 'text-claude-text-dim' : ''}
                    ${theme === 'notion' ? 'text-notion-text-dim' : ''}
                  `}
                >
                  添加新模板
                </div>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={newPromptName}
                    onChange={(e) => setNewPromptName(e.target.value)}
                    placeholder={theme === 'hacker' ? 'TEMPLATE_NAME' : '模板名称'}
                    className={inputClass}
                  />
                  <textarea
                    value={newPromptTemplate}
                    onChange={(e) => setNewPromptTemplate(e.target.value)}
                    placeholder="模板内容...\n使用 {content} 作为需求内容占位符"
                    rows={6}
                    className={`${inputClass} resize-none font-mono text-xs`}
                  />
                  <button
                    onClick={handleCreatePrompt}
                    disabled={promptSaving || !newPromptName.trim() || !newPromptTemplate.trim()}
                    className={buttonPrimaryClass}
                  >
                    {promptSaving ? '创建中...' : '创建模板'}
                  </button>
                </div>
              </div>
            )}

            {/* 刷新按钮 */}
            <button
              onClick={loadPrompts}
              disabled={promptsLoading}
              className={buttonSecondaryClass}
            >
              {promptsLoading ? '加载中...' : '刷新列表'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
