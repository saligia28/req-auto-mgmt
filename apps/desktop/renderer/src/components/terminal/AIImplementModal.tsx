/**
 * AI Implementation Modal
 * AI 实现任务创建弹窗
 */

import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';

interface AITool {
  id: string;
  name: string;
  command: string;
  template: string;
  description?: string;
}

interface CreateSessionRequest {
  cwd: string;
  projectPath: string;
  aiTool: 'claude' | 'codex';
  command: string;
  requirementId?: string;
  initialInput?: string;
}

interface AIImplementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (sessionId: string) => void;
  requirementId?: string;
  requirementTitle?: string;
  requirementContent?: string;
  projectPath?: string;
  requirementsDir?: string; // 需求文件存储目录
}

// 默认 AI 工具配置（备用）
const DEFAULT_TOOLS: AITool[] = [
  {
    id: 'claude',
    name: 'Claude Code',
    command: 'claude',
    template: '',
    description: '进入 Claude Code 交互模式',
  },
  {
    id: 'codex',
    name: 'Codex CLI',
    command: 'codex',
    template: '',
    description: '进入 Codex CLI 交互模式',
  },
];

export function AIImplementModal({
  isOpen,
  onClose,
  onCreated,
  requirementId,
  requirementTitle,
  requirementContent: _requirementContent, // 预留功能
  projectPath: initialPath,
  requirementsDir,
}: AIImplementModalProps) {
  const { settings } = useAppStore();
  const theme = settings.theme;

  const [tools, setTools] = useState<AITool[]>(DEFAULT_TOOLS);
  const [selectedTool, setSelectedTool] = useState<string>('claude');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [customPath, setCustomPath] = useState(initialPath || '');
  const [_customPrompt, _setCustomPrompt] = useState(''); // 预留功能
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canCreate, setCanCreate] = useState(true);

  // 获取项目列表
  const projects = settings.paths.projects || [];

  // 加载可用工具和检查是否可以创建会话
  useEffect(() => {
    if (!isOpen) return;

    // 获取工具列表
    window.electronAPI.terminal.getTools()
      .then((data) => {
        if (data.success && data.tools) {
          setTools(data.tools as AITool[]);
        }
      })
      .catch((err) => {
        console.error('[AIImplementModal] Failed to load tools:', err);
      });

    // 检查是否可以创建新会话
    window.electronAPI.terminal.canCreate()
      .then((canCreateNew) => {
        setCanCreate(canCreateNew);
      })
      .catch(() => {});
  }, [isOpen]);

  // 更新初始路径
  useEffect(() => {
    if (initialPath) {
      setCustomPath(initialPath);
    }
  }, [initialPath]);

  // 获取当前选中的工作目录
  const getWorkingDirectory = (): string => {
    if (selectedProjectId && selectedProjectId !== 'custom') {
      const project = projects.find((p) => p.id === selectedProjectId);
      return project?.path || '';
    }
    return customPath;
  };

  // 构建完整命令（直接执行工具命令，无参数）
  const buildCommand = (): string => {
    const tool = tools.find((t) => t.id === selectedTool);
    if (!tool) return '';

    return tool.command;
  };

  // 生成默认任务文本
  const generateInitialInput = (): string => {
    if (!requirementId || !requirementsDir) return '';

    const titlePart = requirementTitle ? `（${requirementTitle}）` : '';
    return `请到 ${requirementsDir} 目录搜索并分析需求 ${requirementId}${titlePart} 的文件内容。如果有需要补充的信息请提出，用户补充后继续；否则在分析结束后直接实现需求。`;
  };

  // 创建会话
  const handleCreate = async () => {
    const cwd = getWorkingDirectory();
    if (!cwd) {
      setError(theme === 'hacker' ? 'ERROR: NO_PATH' : '请选择或输入项目路径');
      return;
    }

    const command = buildCommand();
    if (!command) {
      setError(theme === 'hacker' ? 'ERROR: NO_COMMAND' : '无法构建命令');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const initialInput = generateInitialInput();
      const request: CreateSessionRequest = {
        cwd,
        projectPath: cwd,
        aiTool: selectedTool as 'claude' | 'codex',
        command,
        requirementId,
        initialInput: initialInput || undefined,
      };

      const session = await window.electronAPI.terminal.createSession(request);

      if (session) {
        onCreated?.(session.id);
        onClose();
        // 重置表单
        _setCustomPrompt('');
        setError(null);
      } else {
        setError('创建会话失败');
      }
    } catch (err) {
      console.error('[AIImplementModal] Failed to create session:', err);
      setError('无法连接到终端服务');
    } finally {
      setLoading(false);
    }
  };

  // 选择目录
  const handleSelectDirectory = async () => {
    try {
      const result = await window.electronAPI.dialog.selectDirectory({
        title: '选择项目目录',
      });

      if (result.success && result.path) {
        setCustomPath(result.path);
        setSelectedProjectId('custom');
      }
    } catch (err) {
      console.error('[AIImplementModal] Failed to select directory:', err);
      setError('选择目录失败');
    }
  };

  if (!isOpen) return null;

  // 样式
  const modalBg = theme === 'hacker' ? 'bg-hacker-panel' : theme === 'notion' ? 'bg-notion-panel' : 'bg-claude-panel';
  const borderColor = theme === 'hacker' ? 'border-hacker-border' : theme === 'notion' ? 'border-notion-border' : 'border-claude-border';
  const textMain = theme === 'hacker' ? 'text-hacker-text-main' : theme === 'notion' ? 'text-notion-text-main' : 'text-claude-text-main';
  const textDim = theme === 'hacker' ? 'text-hacker-text-dim' : theme === 'notion' ? 'text-notion-text-dim' : 'text-claude-text-dim';
  const primaryColor = theme === 'hacker' ? 'bg-hacker-primary text-black' : theme === 'notion' ? 'bg-notion-primary text-white' : 'bg-claude-primary text-white';
  const inputBg = theme === 'hacker' ? 'bg-hacker-bg' : theme === 'notion' ? 'bg-notion-bg' : 'bg-claude-bg';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className={`${modalBg} rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden border ${borderColor}`}>
        {/* 标题栏 */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${borderColor}`}>
          <h2 className={`text-lg font-semibold ${textMain} ${theme === 'hacker' ? 'font-mono' : ''}`}>
            {theme === 'hacker' ? '> AI 实现' : 'AI 实现'}
          </h2>
          <button onClick={onClose} className={`${textDim} hover:${textMain}`}>
            ×
          </button>
        </div>

        {/* 内容区 */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* 需求信息 */}
          {requirementId && (
            <div className={`p-4 ${inputBg} rounded-lg border ${borderColor}`}>
              <div className={`text-sm ${textDim} mb-1 ${theme === 'hacker' ? 'font-mono' : ''}`}>
                关联需求
              </div>
              <div className={`font-medium ${textMain}`}>
                {requirementTitle || requirementId}
              </div>
            </div>
          )}

          {/* 工具选择 */}
          <div className="space-y-2">
            <label className={`block text-sm font-medium ${textMain} ${theme === 'hacker' ? 'font-mono' : ''}`}>
              选择 AI 工具
            </label>
            <div className="grid grid-cols-2 gap-4">
              {tools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => setSelectedTool(tool.id)}
                  className={`p-4 rounded-lg border-2 text-left transition-colors ${
                    selectedTool === tool.id
                      ? theme === 'hacker'
                        ? 'border-hacker-primary bg-hacker-primary/10'
                        : theme === 'notion'
                        ? 'border-notion-primary bg-notion-primary/10'
                        : 'border-claude-primary bg-claude-primary/10'
                      : `${borderColor} hover:opacity-80`
                  }`}
                >
                  <div className={`font-medium mb-1 ${textMain} ${theme === 'hacker' ? 'font-mono' : ''}`}>
                    {tool.name}
                  </div>
                  <div className={`text-xs ${textDim} mt-2 font-mono`}>
                    $ {tool.command}
                  </div>
                  {tool.description && (
                    <div className={`text-xs ${textDim} mt-1`}>
                      {tool.description}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 项目路径选择 */}
          <div className="space-y-2">
            <label className={`block text-sm font-medium ${textMain} ${theme === 'hacker' ? 'font-mono' : ''}`}>
              项目路径
            </label>

            {/* 已配置的项目列表 */}
            {projects.length > 0 && (
              <div className="space-y-2 mb-3">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => {
                      setSelectedProjectId(project.id);
                      setCustomPath(project.path);
                    }}
                    className={`w-full p-3 rounded-lg border text-left transition-colors ${
                      selectedProjectId === project.id
                        ? theme === 'hacker'
                          ? 'border-hacker-primary bg-hacker-primary/10'
                          : theme === 'notion'
                          ? 'border-notion-primary bg-notion-primary/10'
                          : 'border-claude-primary bg-claude-primary/10'
                        : `${borderColor} ${inputBg}`
                    }`}
                  >
                    <div className={`font-medium ${textMain} ${theme === 'hacker' ? 'font-mono' : ''}`}>
                      {project.label}
                    </div>
                    <div className={`text-xs ${textDim} font-mono truncate`}>
                      {project.path}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* 自定义路径输入 */}
            <div className="flex gap-2">
              <input
                type="text"
                value={customPath}
                onChange={(e) => {
                  setCustomPath(e.target.value);
                  setSelectedProjectId('custom');
                }}
                placeholder="/path/to/project"
                className={`flex-1 px-4 py-2 border ${borderColor} rounded-lg ${inputBg} ${textMain} focus:outline-none focus:ring-2 ${
                  theme === 'hacker' ? 'focus:ring-hacker-primary font-mono' : theme === 'notion' ? 'focus:ring-notion-primary' : 'focus:ring-claude-primary'
                }`}
              />
              <button
                onClick={handleSelectDirectory}
                className={`px-4 py-2 ${inputBg} border ${borderColor} rounded-lg hover:opacity-80 ${textMain} ${theme === 'hacker' ? 'font-mono' : ''}`}
              >
                浏览...
              </button>
            </div>
          </div>

          {/* 自定义提示词 - 暂时隐藏 */}
          {/* <div className="space-y-2">
            <label className={`block text-sm font-medium ${textMain} ${theme === 'hacker' ? 'font-mono' : ''}`}>
              自定义提示词{' '}
              <span className={textDim}>（可选）</span>
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder={generateDefaultPrompt() || '输入自定义提示词...'}
              rows={6}
              className={`w-full px-4 py-2 border ${borderColor} rounded-lg ${inputBg} ${textMain} focus:outline-none focus:ring-2 resize-none font-mono text-sm ${
                theme === 'hacker' ? 'focus:ring-hacker-primary' : theme === 'notion' ? 'focus:ring-notion-primary' : 'focus:ring-claude-primary'
              }`}
            />
          </div> */}

          {/* 命令预览 */}
          <div className="space-y-2">
            <label className={`block text-sm font-medium ${textMain} ${theme === 'hacker' ? 'font-mono' : ''}`}>
              命令预览
            </label>
            <div className={`p-3 ${inputBg} border ${borderColor} rounded-lg font-mono text-xs ${textDim} break-all`}>
              {buildCommand() || '无命令'}
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className={`p-3 rounded-lg text-sm ${theme === 'hacker' ? 'bg-red-900/30 text-red-400 font-mono' : 'bg-red-100 text-red-700'}`}>
              {error}
            </div>
          )}

          {/* 并行限制警告 */}
          {!canCreate && (
            <div className={`p-3 rounded-lg text-sm ${theme === 'hacker' ? 'bg-yellow-900/30 text-yellow-400 font-mono' : 'bg-yellow-100 text-yellow-700'}`}>
              已达到最大并行会话数（3个），请等待现有任务完成或关闭一个会话
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className={`flex justify-end gap-3 px-6 py-4 border-t ${borderColor}`}>
          <button
            onClick={onClose}
            className={`px-6 py-2 border ${borderColor} rounded-lg hover:opacity-80 ${textMain} ${theme === 'hacker' ? 'font-mono' : ''}`}
          >
            取消
          </button>
          <button
            onClick={handleCreate}
            disabled={loading || !canCreate || !getWorkingDirectory()}
            className={`px-6 py-2 rounded-lg ${primaryColor} ${theme === 'hacker' ? 'font-mono' : ''} ${
              loading || !canCreate || !getWorkingDirectory() ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'
            }`}
          >
            {loading ? '创建中...' : '开始执行'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIImplementModal;
