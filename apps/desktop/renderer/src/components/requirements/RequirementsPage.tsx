import { FC, useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import { AIImplementModal } from '@/components/terminal/AIImplementModal';

// 类型定义
interface TapdIteration {
  id: string;
  name: string;
  status?: string;
  startdate?: string;
  enddate?: string;
}

interface StorySummary {
  id: string;
  title: string;
  status?: string | null;
  statusLabel?: string | null;
  owners: string[];
  frontend?: string | null;
  iteration?: string | null;
  iterationId?: string | null;
  updatedAt?: string | null;
  url?: string | null;
}

interface StoryDetail extends StorySummary {
  description: string;
  priority?: string;
  creator?: string;
  createdAt?: string;
  module?: string;
}

interface LocalFile {
  id: string;
  filename: string;
  path: string;
  title: string;
  storyId: string;
  owners: string[];
  createdAt: string;
  modifiedAt: string;
  size: number;
}

type TabType = 'tapd' | 'local';

// 迭代选择缓存key
const ITERATION_CACHE_KEY = 'req-mgmt:selected-iteration-id';

// 需求相关人员快捷筛选 (固定配置)
const RELATED_PERSON_TOKENS = ['江林', '喻童', '王荣祥'];

// 从 Markdown 中分离内容：AI 分析之前、AI 分析部分、AI 分析之后
function separateContent(markdown: string): {
  beforeAI: string;
  afterAI: string;
  hasAISection: boolean;
} {
  // 找到 AI 分析部分的开始位置
  const aiSectionStartRegex = /^---\s*\n+##\s*AI\s*分析/m;
  const startMatch = markdown.match(aiSectionStartRegex);

  if (!startMatch || startMatch.index === undefined) {
    return {
      beforeAI: markdown.trim(),
      afterAI: '',
      hasAISection: false,
    };
  }

  const beforeAI = markdown.substring(0, startMatch.index).trim();
  const afterStart = markdown.substring(startMatch.index);

  // 找到 AI 分析部分的结束位置
  // AI 分析部分结束于：下一个 "---" 分隔线开头的新部分，或者下一个非 AI 分析的二级标题
  const aiSectionEndRegex = /\n(?=---\s*\n(?!##\s*AI\s*分析)|\n##\s+(?!#)(?!AI\s*分析))/;
  const endMatch = afterStart.match(aiSectionEndRegex);

  if (endMatch && endMatch.index !== undefined) {
    const afterAI = afterStart.substring(endMatch.index).trim();
    return {
      beforeAI,
      afterAI,
      hasAISection: true,
    };
  }

  return {
    beforeAI,
    afterAI: '',
    hasAISection: true,
  };
}

export const RequirementsPage: FC = () => {
  const { settings } = useAppStore();
  const theme = settings.theme;

  // Tab 状态
  const [activeTab, setActiveTab] = useState<TabType>('tapd');

  // TAPD 状态
  const [isConfigured, setIsConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [iterations, setIterations] = useState<TapdIteration[]>([]);
  const [selectedIterationId, setSelectedIterationId] = useState<string>('');
  const [stories, setStories] = useState<StorySummary[]>([]);
  const [selectedStory, setSelectedStory] = useState<StoryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 本地文件状态
  const [localFiles, setLocalFiles] = useState<LocalFile[]>([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<LocalFile | null>(null);
  const [fileContent, setFileContent] = useState<string>('');

  // 文件创建状态
  const [creating, setCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // 批量创建状态
  const [batchCreating, setBatchCreating] = useState(false);
  const [batchResult, setBatchResult] = useState<{
    created: number;
    skipped: number;
    errors: number;
  } | null>(null);

  // AI 实现状态
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiImplementStory, setAIImplementStory] = useState<StoryDetail | null>(null);

  // 前端筛选状态（多选）- TAPD 和本地文件分开
  const [tapdOwnerFilters, setTapdOwnerFilters] = useState<Set<string>>(new Set());
  const [localOwnerFilters, setLocalOwnerFilters] = useState<Set<string>>(new Set());
  const [showOwnerDropdown, setShowOwnerDropdown] = useState(false);

  // 批量选择状态
  const [selectedStoryIds, setSelectedStoryIds] = useState<Set<string>>(new Set());

  // 本地文件勾选状态
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());

  // 本地文件 AI 实现状态
  const [aiImplementFile, setAIImplementFile] = useState<LocalFile | null>(null);

  // 批量 AI 分析状态
  const [batchAnalyzing, setBatchAnalyzing] = useState(false);
  const [batchAnalyzeResult, setBatchAnalyzeResult] = useState<{
    success: number;
    failed: number;
  } | null>(null);

  // 每个文件的独立 AI 分析状态
  const [analyzingFiles, setAnalyzingFiles] = useState<Map<string, boolean>>(new Map());

  // 更新单个文件的分析状态
  const setFileAnalyzing = useCallback((fileId: string, analyzing: boolean) => {
    setAnalyzingFiles((prev) => {
      const next = new Map(prev);
      if (analyzing) {
        next.set(fileId, true);
      } else {
        next.delete(fileId);
      }
      return next;
    });
  }, []);

  // 批量删除状态
  const [batchDeleting, setBatchDeleting] = useState(false);

  // 获取需求目录
  const requirementsDir = settings.paths.requirementsDir;

  // 检查需求是否与筛选条件相关（负责人、前端字段）
  const isStoryRelated = (story: StorySummary, filters: Set<string>): boolean => {
    const filterTokens = Array.from(filters);
    // 检查负责人
    const ownerMatch = story.owners.some((owner) =>
      filterTokens.some((token) => owner.includes(token))
    );
    if (ownerMatch) return true;
    // 检查前端字段
    if (story.frontend) {
      const frontendMatch = filterTokens.some((token) => story.frontend!.includes(token));
      if (frontendMatch) return true;
    }
    return false;
  };

  // 筛选后的需求列表（匹配负责人或前端字段）
  const filteredStories = tapdOwnerFilters.size > 0
    ? stories.filter((story) => isStoryRelated(story, tapdOwnerFilters))
    : stories;

  // 检查本地文件是否与筛选条件相关
  const isFileRelated = (file: LocalFile, filters: Set<string>): boolean => {
    const filterTokens = Array.from(filters);
    // 检查负责人
    return (file.owners || []).some((owner) =>
      filterTokens.some((token) => owner.includes(token))
    );
  };

  // 筛选后的本地文件列表
  const filteredLocalFiles = localOwnerFilters.size > 0
    ? localFiles.filter((file) => isFileRelated(file, localOwnerFilters))
    : localFiles;

  // 当筛选条件变化时清空选择
  useEffect(() => {
    setSelectedStoryIds(new Set());
  }, [tapdOwnerFilters, selectedIterationId]);

  useEffect(() => {
    setSelectedFileIds(new Set());
  }, [localOwnerFilters]);

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.owner-filter-dropdown')) {
        setShowOwnerDropdown(false);
      }
    };
    if (showOwnerDropdown) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showOwnerDropdown]);

  // 检查配置状态
  useEffect(() => {
    async function checkConfig() {
      try {
        const configured = await window.electronAPI.tapd.isConfigured();
        setIsConfigured(configured);
        if (configured) {
          loadIterations();
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to check TAPD config:', err);
        setLoading(false);
      }
    }
    checkConfig();
  }, []);

  // 当切换到本地文件 Tab 时加载文件列表
  useEffect(() => {
    if (activeTab === 'local' && requirementsDir) {
      loadLocalFiles();
    }
  }, [activeTab, requirementsDir]);

  // 加载迭代列表
  const loadIterations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await window.electronAPI.tapd.getIterations();
      if (result.success && result.data) {
        const iters = result.data as TapdIteration[];
        setIterations(iters);

        // 优先使用缓存的迭代ID
        const cachedIterationId = localStorage.getItem(ITERATION_CACHE_KEY);
        if (cachedIterationId && iters.some((iter) => iter.id === cachedIterationId)) {
          setSelectedIterationId(cachedIterationId);
        } else {
          // 没有缓存或缓存的迭代不存在，获取当前迭代
          const currentResult = await window.electronAPI.tapd.getCurrentIteration();
          if (currentResult.success && currentResult.data) {
            const current = currentResult.data as TapdIteration;
            setSelectedIterationId(current.id);
            localStorage.setItem(ITERATION_CACHE_KEY, current.id);
          } else if (iters.length > 0) {
            setSelectedIterationId(iters[0].id);
            localStorage.setItem(ITERATION_CACHE_KEY, iters[0].id);
          }
        }
      } else {
        setError(result.error || 'Failed to load iterations');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // 加载需求列表
  const loadStories = useCallback(async (iterationId: string) => {
    if (!iterationId) return;

    try {
      setLoading(true);
      setError(null);

      const result = await window.electronAPI.tapd.getStories({ iterationId });
      if (result.success && result.data) {
        setStories(result.data as StorySummary[]);
      } else {
        setError(result.error || 'Failed to load stories');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // 当选择迭代变化时加载需求
  useEffect(() => {
    if (selectedIterationId && isConfigured) {
      loadStories(selectedIterationId);
    }
  }, [selectedIterationId, isConfigured, loadStories]);

  // 加载需求详情
  const loadStoryDetail = useCallback(async (id: string) => {
    try {
      setDetailLoading(true);
      const result = await window.electronAPI.tapd.getStory(id);
      if (result.success && result.data) {
        setSelectedStory(result.data as StoryDetail);
      }
    } catch (err) {
      console.error('Failed to load story detail:', err);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // 加载本地文件列表
  const loadLocalFiles = useCallback(async () => {
    if (!requirementsDir) return;

    try {
      setLocalLoading(true);
      const result = await window.electronAPI.file.list(requirementsDir);
      if (result.success && result.data) {
        setLocalFiles(result.data as LocalFile[]);
      }
    } catch (err) {
      console.error('Failed to load local files:', err);
    } finally {
      setLocalLoading(false);
    }
  }, [requirementsDir]);

  // 加载本地文件内容
  const loadFileContent = useCallback(async (file: LocalFile) => {
    try {
      setSelectedFile(file);
      const result = await window.electronAPI.file.read(file.path);
      if (result.success && result.content) {
        setFileContent(result.content);
      }
    } catch (err) {
      console.error('Failed to read file:', err);
    }
  }, []);

  // 创建需求文件
  const handleCreateFile = async (story: StoryDetail) => {
    if (!requirementsDir) {
      setCreateMessage({
        type: 'error',
        text:
          theme === 'hacker' ? 'ERROR: REQUIREMENTS_DIR_NOT_SET' : '请先在设置中配置需求文件目录',
      });
      return;
    }

    try {
      setCreating(true);
      setCreateMessage(null);

      const result = await window.electronAPI.file.create(story, requirementsDir);
      if (result.success) {
        setCreateMessage({
          type: 'success',
          text: '文件创建成功',
        });
        // 刷新本地文件列表
        loadLocalFiles();
      } else {
        setCreateMessage({
          type: 'error',
          text: result.error || '创建失败',
        });
      }
    } catch (err) {
      setCreateMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setCreating(false);
      // 3秒后清除消息
      setTimeout(() => setCreateMessage(null), 3000);
    }
  };

  // 删除本地文件
  const handleDeleteFile = async (file: LocalFile) => {
    const confirmText = theme === 'hacker' ? 'CONFIRM_DELETE?' : `确认删除文件 ${file.filename}？`;
    if (!confirm(confirmText)) return;

    try {
      const result = await window.electronAPI.file.delete(file.path);
      if (result.success) {
        loadLocalFiles();
        if (selectedFile?.id === file.id) {
          setSelectedFile(null);
          setFileContent('');
        }
      } else {
        alert(result.error || '删除失败');
      }
    } catch (err) {
      console.error('Failed to delete file:', err);
    }
  };

  // 刷新
  const handleRefresh = () => {
    if (activeTab === 'tapd' && selectedIterationId) {
      loadStories(selectedIterationId);
    } else if (activeTab === 'local') {
      loadLocalFiles();
    }
  };

  // 批量创建需求文件
  const handleBatchCreate = async () => {
    if (!requirementsDir) {
      alert(
        theme === 'hacker' ? 'ERROR: REQUIREMENTS_DIR_NOT_SET' : '请先在设置中配置需求文件目录'
      );
      return;
    }

    // 获取要创建的需求（选中的或全部）
    const storiesToCreate =
      selectedStoryIds.size > 0
        ? filteredStories.filter((s) => selectedStoryIds.has(s.id))
        : filteredStories;

    if (storiesToCreate.length === 0) {
      alert(theme === 'hacker' ? 'ERROR: NO_STORIES' : '没有需求可创建');
      return;
    }

    const confirmText =
      theme === 'hacker'
        ? `BATCH_CREATE ${storiesToCreate.length} FILES?`
        : `确认为 ${selectedStoryIds.size > 0 ? '选中的' : '当前'} ${storiesToCreate.length} 条需求创建文件？`;
    if (!confirm(confirmText)) return;

    try {
      setBatchCreating(true);
      setBatchResult(null);

      const result = await window.electronAPI.file.createBatch(storiesToCreate, requirementsDir);

      setBatchResult({
        created: result.created?.length || 0,
        skipped: result.skipped?.length || 0,
        errors: result.errors?.length || 0,
      });

      // 刷新本地文件列表
      loadLocalFiles();

      // 清空选择
      setSelectedStoryIds(new Set());

      // 5秒后清除结果
      setTimeout(() => setBatchResult(null), 5000);
    } catch (err) {
      console.error('Batch create failed:', err);
      alert(err instanceof Error ? err.message : '批量创建失败');
    } finally {
      setBatchCreating(false);
    }
  };

  // AI 实现
  const handleAIImplement = (story: StoryDetail) => {
    setAIImplementStory(story);
    setShowAIModal(true);
  };

  // AI 实现完成后
  const handleAIImplementCreated = (sessionId: string) => {
    console.log('[RequirementsPage] AI session created:', sessionId);
    setShowAIModal(false);
    setAIImplementStory(null);
    setAIImplementFile(null);
    // 切换到终端页面
    const { setCurrentNav } = useAppStore.getState();
    setCurrentNav('terminal');
  };

  // 本地文件 AI 实现
  const handleLocalFileAIImplement = (file: LocalFile) => {
    setAIImplementFile(file);
    setShowAIModal(true);
  };

  // 批量 AI 分析
  const handleBatchAnalyze = async () => {
    const filesToAnalyze = selectedFileIds.size > 0
      ? filteredLocalFiles.filter((f) => selectedFileIds.has(f.id))
      : filteredLocalFiles;

    if (filesToAnalyze.length === 0) {
      alert(theme === 'hacker' ? 'ERROR: NO_FILES' : '没有文件可分析');
      return;
    }

    if (filesToAnalyze.length > 20) {
      alert(theme === 'hacker' ? 'ERROR: MAX_20_FILES' : '最多只能分析 20 个文件');
      return;
    }

    const confirmText = theme === 'hacker'
      ? `BATCH_ANALYZE ${filesToAnalyze.length} FILES?`
      : `确认分析 ${selectedFileIds.size > 0 ? '选中的' : ''} ${filesToAnalyze.length} 个文件？`;
    if (!confirm(confirmText)) return;

    try {
      setBatchAnalyzing(true);
      setBatchAnalyzeResult(null);

      let successCount = 0;
      let failedCount = 0;

      for (const file of filesToAnalyze) {
        try {
          // 读取文件内容
          const readResult = await window.electronAPI.file.read(file.path);
          if (!readResult.success || !readResult.content) {
            failedCount++;
            continue;
          }

          // 分离内容：AI 分析之前、AI 分析之后
          const content = readResult.content;
          const { beforeAI, afterAI } = separateContent(content);
          const requirementContent = beforeAI;

          if (!requirementContent) {
            failedCount++;
            continue;
          }

          // 调用 AI 分析
          const analyzeResult = await window.electronAPI.ai.analyze(requirementContent);
          if (!analyzeResult.success || !analyzeResult.result) {
            failedCount++;
            continue;
          }

          // 格式化分析结果
          const lines: string[] = [];
          lines.push('---');
          lines.push('');
          lines.push('## AI 分析');
          lines.push('');
          lines.push(`> 分析时间: ${new Date(analyzeResult.result.analyzedAt).toLocaleString()}`);
          lines.push(`> 使用模型: ${analyzeResult.result.provider}/${analyzeResult.result.model}`);
          lines.push('');
          if (analyzeResult.result.summary) {
            lines.push('### 需求要点');
            lines.push('');
            lines.push(analyzeResult.result.summary);
            lines.push('');
          }
          if (analyzeResult.result.testCases?.length > 0) {
            lines.push('### 测试用例建议');
            lines.push('');
            analyzeResult.result.testCases.forEach((tc: string, index: number) => {
              lines.push(`${index + 1}. ${tc}`);
            });
            lines.push('');
          }

          // 保存文件：需求内容 + AI 分析 + 原有的后续内容
          let newContent = requirementContent + '\n\n' + lines.join('\n');
          if (afterAI) {
            newContent += '\n\n' + afterAI;
          }
          const saveResult = await window.electronAPI.file.save(file.path, newContent);
          if (saveResult.success) {
            successCount++;
          } else {
            failedCount++;
          }
        } catch {
          failedCount++;
        }
      }

      setBatchAnalyzeResult({ success: successCount, failed: failedCount });
      setSelectedFileIds(new Set());
      loadLocalFiles();

      // 5秒后清除结果
      setTimeout(() => setBatchAnalyzeResult(null), 5000);
    } catch (err) {
      console.error('Batch analyze failed:', err);
      alert(err instanceof Error ? err.message : '批量分析失败');
    } finally {
      setBatchAnalyzing(false);
    }
  };

  // 批量删除本地文件
  const handleBatchDelete = async () => {
    const filesToDelete = selectedFileIds.size > 0
      ? filteredLocalFiles.filter((f) => selectedFileIds.has(f.id))
      : [];

    if (filesToDelete.length === 0) {
      alert(theme === 'hacker' ? 'ERROR: NO_FILES_SELECTED' : '请先勾选要删除的文件');
      return;
    }

    const confirmText = theme === 'hacker'
      ? `BATCH_DELETE ${filesToDelete.length} FILES?`
      : `确认删除选中的 ${filesToDelete.length} 个文件？此操作不可恢复！`;
    if (!confirm(confirmText)) return;

    try {
      setBatchDeleting(true);

      let successCount = 0;
      let failedCount = 0;

      for (const file of filesToDelete) {
        try {
          const result = await window.electronAPI.file.delete(file.path);
          if (result.success) {
            successCount++;
          } else {
            failedCount++;
          }
        } catch {
          failedCount++;
        }
      }

      // 如果当前选中的文件被删除了，清除选中状态
      if (selectedFile && filesToDelete.some(f => f.id === selectedFile.id)) {
        setSelectedFile(null);
        setFileContent('');
      }

      setSelectedFileIds(new Set());
      loadLocalFiles();

      // 显示结果
      const resultText = theme === 'hacker'
        ? `DELETED: ${successCount} | FAILED: ${failedCount}`
        : `已删除 ${successCount} 个文件${failedCount > 0 ? `，${failedCount} 个失败` : ''}`;
      alert(resultText);
    } catch (err) {
      console.error('Batch delete failed:', err);
      alert(err instanceof Error ? err.message : '批量删除失败');
    } finally {
      setBatchDeleting(false);
    }
  };

  // 未配置提示 (仅 TAPD tab)
  if (activeTab === 'tapd' && !isConfigured && !loading) {
    return (
      <div className="h-full flex flex-col">
        <PageHeader theme={theme} />
        <TabBar theme={theme} activeTab={activeTab} onTabChange={setActiveTab} />
        <div
          className={`
            flex-1 rounded-lg p-8 border flex items-center justify-center
            ${theme === 'hacker' ? 'bg-hacker-panel border-hacker-border' : ''}
            ${theme === 'claude' ? 'bg-claude-panel border-claude-border shadow-soft' : ''}
            ${theme === 'notion' ? 'bg-notion-panel border-notion-border shadow-soft' : ''}
          `}
        >
          <div className="text-center">
            <p
              className={`
                text-lg mb-4
                ${theme === 'hacker' ? 'text-hacker-text-dim font-mono' : ''}
                ${theme === 'claude' ? 'text-claude-text-dim' : ''}
                ${theme === 'notion' ? 'text-notion-text-dim' : ''}
              `}
            >
              {theme === 'hacker' ? '// ERROR: TAPD_NOT_CONFIGURED' : 'TAPD 尚未配置'}
            </p>
            <p
              className={`
                text-sm
                ${theme === 'hacker' ? 'text-hacker-text-dim font-mono' : ''}
                ${theme === 'claude' ? 'text-claude-text-dim' : ''}
                ${theme === 'notion' ? 'text-notion-text-dim' : ''}
              `}
            >
              {theme === 'hacker'
                ? '// Navigate to SETTINGS to configure TAPD credentials'
                : '请前往设置页面配置 TAPD 凭证'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <PageHeader theme={theme} />
      <TabBar theme={theme} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* 工具栏 */}
      <div className="flex items-center gap-4 mb-4">
        {activeTab === 'tapd' && (
          /* 迭代选择 */
          <div className="flex items-center gap-2">
            <label
              className={`
                text-sm
                ${theme === 'hacker' ? 'text-hacker-text-dim font-mono' : ''}
                ${theme === 'claude' ? 'text-claude-text-dim' : ''}
                ${theme === 'notion' ? 'text-notion-text-dim' : ''}
              `}
            >
              {theme === 'hacker' ? 'ITERATION:' : '迭代'}
            </label>
            <select
              value={selectedIterationId}
              onChange={(e) => {
                const newId = e.target.value;
                setSelectedIterationId(newId);
                localStorage.setItem(ITERATION_CACHE_KEY, newId);
              }}
              className={`
                px-3 py-1.5 rounded-md text-sm min-w-[200px]
                ${theme === 'hacker' ? 'bg-hacker-panel border border-hacker-border text-hacker-text-main font-mono' : ''}
                ${theme === 'claude' ? 'bg-claude-panel border border-claude-border text-claude-text-main' : ''}
                ${theme === 'notion' ? 'bg-notion-panel border border-notion-border text-notion-text-main' : ''}
              `}
            >
              {iterations.map((iter) => (
                <option key={iter.id} value={iter.id}>
                  {iter.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 需求相关筛选下拉框（两个 tab 独立） */}
        <div className="relative owner-filter-dropdown">
          <button
            onClick={() => setShowOwnerDropdown(!showOwnerDropdown)}
            className={`
              px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-2
              ${(activeTab === 'tapd' ? tapdOwnerFilters : localOwnerFilters).size > 0
                ? theme === 'hacker'
                  ? 'bg-hacker-primary text-black font-mono'
                  : theme === 'claude'
                    ? 'bg-claude-primary text-white'
                    : 'bg-notion-primary text-white'
                : theme === 'hacker'
                  ? 'bg-hacker-panel border border-hacker-border text-hacker-text-main hover:border-hacker-primary font-mono'
                  : theme === 'claude'
                    ? 'bg-claude-panel border border-claude-border text-claude-text-main hover:border-claude-primary'
                    : 'bg-notion-panel border border-notion-border text-notion-text-main hover:border-notion-primary'
              }
            `}
          >
            <span>
              {(activeTab === 'tapd' ? tapdOwnerFilters : localOwnerFilters).size > 0
                ? `需求相关(${(activeTab === 'tapd' ? tapdOwnerFilters : localOwnerFilters).size})`
                : '需求相关'
              }
            </span>
            <span className="text-xs">{showOwnerDropdown ? '▲' : '▼'}</span>
          </button>

          {/* 下拉菜单 */}
          {showOwnerDropdown && (
            <div
              className={`
                absolute top-full left-0 mt-1 z-50 min-w-[150px] rounded-md shadow-lg overflow-hidden
                ${theme === 'hacker' ? 'bg-hacker-panel border border-hacker-border' : ''}
                ${theme === 'claude' ? 'bg-claude-panel border border-claude-border' : ''}
                ${theme === 'notion' ? 'bg-notion-panel border border-notion-border' : ''}
              `}
            >
              {RELATED_PERSON_TOKENS.map((person) => (
                <label
                  key={person}
                  className={`
                    flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors
                    ${theme === 'hacker' ? 'hover:bg-hacker-primary/20 text-hacker-text-main font-mono' : ''}
                    ${theme === 'claude' ? 'hover:bg-claude-bg text-claude-text-main' : ''}
                    ${theme === 'notion' ? 'hover:bg-notion-bg text-notion-text-main' : ''}
                  `}
                >
                  <input
                    type="checkbox"
                    checked={(activeTab === 'tapd' ? tapdOwnerFilters : localOwnerFilters).has(person)}
                    onChange={() => {
                      const currentFilters = activeTab === 'tapd' ? tapdOwnerFilters : localOwnerFilters;
                      const setFilters = activeTab === 'tapd' ? setTapdOwnerFilters : setLocalOwnerFilters;
                      const newSet = new Set(currentFilters);
                      if (newSet.has(person)) {
                        newSet.delete(person);
                      } else {
                        newSet.add(person);
                      }
                      setFilters(newSet);
                    }}
                    className={`
                      w-4 h-4 rounded cursor-pointer
                      ${theme === 'hacker' ? 'accent-hacker-primary' : ''}
                      ${theme === 'claude' ? 'accent-claude-primary' : ''}
                      ${theme === 'notion' ? 'accent-notion-primary' : ''}
                    `}
                  />
                  <span className="text-sm">{person}</span>
                </label>
              ))}
              {(activeTab === 'tapd' ? tapdOwnerFilters : localOwnerFilters).size > 0 && (
                <button
                  onClick={() => (activeTab === 'tapd' ? setTapdOwnerFilters : setLocalOwnerFilters)(new Set())}
                  className={`
                    w-full px-3 py-2 text-xs text-center border-t transition-colors
                    ${theme === 'hacker' ? 'border-hacker-border text-hacker-text-dim hover:text-hacker-primary font-mono' : ''}
                    ${theme === 'claude' ? 'border-claude-border text-claude-text-dim hover:text-claude-primary' : ''}
                    ${theme === 'notion' ? 'border-notion-border text-notion-text-dim hover:text-notion-primary' : ''}
                  `}
                >
                  清除筛选
                </button>
              )}
            </div>
          )}
        </div>

        {/* 刷新按钮 */}
        <button
          onClick={handleRefresh}
          disabled={loading || localLoading}
          className={`
            px-3 py-1.5 rounded-md text-sm transition-colors
            ${
              theme === 'hacker'
                ? 'bg-hacker-panel border border-hacker-primary text-hacker-primary hover:bg-hacker-primary hover:text-black font-mono'
                : ''
            }
            ${theme === 'claude' ? 'bg-claude-primary text-white hover:bg-claude-primary/90' : ''}
            ${theme === 'notion' ? 'bg-notion-primary text-white hover:bg-notion-primary/90' : ''}
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {loading || localLoading ? (theme === 'hacker' ? 'LOADING...' : '加载中...') : '刷新'}
        </button>

        {/* 批量创建按钮（仅 TAPD Tab） */}
        {activeTab === 'tapd' && filteredStories.length > 0 && (
          <button
            onClick={handleBatchCreate}
            disabled={batchCreating || !requirementsDir}
            className={`
              px-3 py-1.5 rounded-md text-sm transition-colors
              ${
                theme === 'hacker'
                  ? 'bg-hacker-panel border border-hacker-border text-hacker-text-main hover:border-hacker-primary hover:text-hacker-primary font-mono'
                  : ''
              }
              ${
                theme === 'claude'
                  ? 'bg-claude-panel border border-claude-border text-claude-text-main hover:border-claude-primary hover:text-claude-primary'
                  : ''
              }
              ${
                theme === 'notion'
                  ? 'bg-notion-panel border border-notion-border text-notion-text-main hover:border-notion-primary hover:text-notion-primary'
                  : ''
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            title={
              !requirementsDir
                ? '请先设置需求目录'
                : selectedStoryIds.size > 0
                  ? `创建选中的 ${selectedStoryIds.size} 条需求`
                  : ''
            }
          >
            {batchCreating
              ? theme === 'hacker'
                ? 'CREATING...'
                : '创建中...'
              : selectedStoryIds.size > 0
                ? theme === 'hacker'
                  ? `BATCH_CREATE(${selectedStoryIds.size})`
                  : `批量创建(${selectedStoryIds.size})`
                : theme === 'hacker'
                  ? 'BATCH_CREATE'
                  : '批量创建'}
          </button>
        )}

        {/* 批量创建结果 */}
        {batchResult && (
          <span
            className={`
              text-xs px-2 py-1 rounded
              ${theme === 'hacker' ? 'bg-hacker-bg text-hacker-text-main font-mono' : ''}
              ${theme === 'claude' ? 'bg-claude-bg text-claude-text-main' : ''}
              ${theme === 'notion' ? 'bg-notion-bg text-notion-text-main' : ''}
            `}
          >
            {theme === 'hacker'
              ? `CREATED: ${batchResult.created} | SKIPPED: ${batchResult.skipped} | ERRORS: ${batchResult.errors}`
              : `创建: ${batchResult.created} | 跳过: ${batchResult.skipped} | 失败: ${batchResult.errors}`}
          </span>
        )}

        {/* 批量 AI 分析按钮（仅本地文件 Tab） */}
        {activeTab === 'local' && filteredLocalFiles.length > 0 && (
          <button
            onClick={handleBatchAnalyze}
            disabled={batchAnalyzing || filteredLocalFiles.length > 20}
            className={`
              px-3 py-1.5 rounded-md text-sm transition-colors
              ${
                theme === 'hacker'
                  ? 'bg-hacker-panel border border-hacker-border text-hacker-text-main hover:border-hacker-primary hover:text-hacker-primary font-mono'
                  : ''
              }
              ${
                theme === 'claude'
                  ? 'bg-claude-panel border border-claude-border text-claude-text-main hover:border-claude-primary hover:text-claude-primary'
                  : ''
              }
              ${
                theme === 'notion'
                  ? 'bg-notion-panel border border-notion-border text-notion-text-main hover:border-notion-primary hover:text-notion-primary'
                  : ''
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            title={filteredLocalFiles.length > 20 ? '最多分析 20 个文件' : selectedFileIds.size > 0 ? `分析选中的 ${selectedFileIds.size} 个文件` : ''}
          >
            {batchAnalyzing
              ? theme === 'hacker' ? 'ANALYZING...' : '分析中...'
              : selectedFileIds.size > 0
                ? theme === 'hacker' ? `AI_ANALYZE(${selectedFileIds.size})` : `AI 分析(${selectedFileIds.size})`
                : theme === 'hacker' ? 'AI_ANALYZE' : 'AI 分析'
            }
          </button>
        )}

        {/* 批量删除按钮（仅本地文件 Tab，需要勾选） */}
        {activeTab === 'local' && selectedFileIds.size > 0 && (
          <button
            onClick={handleBatchDelete}
            disabled={batchDeleting}
            className={`
              px-3 py-1.5 rounded-md text-sm transition-colors
              ${
                theme === 'hacker'
                  ? 'bg-red-900/30 border border-red-500 text-red-400 hover:bg-red-900/50 font-mono'
                  : ''
              }
              ${
                theme === 'claude'
                  ? 'bg-red-50 border border-red-300 text-red-600 hover:bg-red-100'
                  : ''
              }
              ${
                theme === 'notion'
                  ? 'bg-red-50 border border-red-300 text-red-600 hover:bg-red-100'
                  : ''
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {batchDeleting
              ? theme === 'hacker' ? 'DELETING...' : '删除中...'
              : theme === 'hacker' ? `DELETE(${selectedFileIds.size})` : `删除(${selectedFileIds.size})`
            }
          </button>
        )}

        {/* 批量 AI 分析结果 */}
        {batchAnalyzeResult && (
          <span
            className={`
              text-xs px-2 py-1 rounded
              ${theme === 'hacker' ? 'bg-hacker-bg text-hacker-text-main font-mono' : ''}
              ${theme === 'claude' ? 'bg-claude-bg text-claude-text-main' : ''}
              ${theme === 'notion' ? 'bg-notion-bg text-notion-text-main' : ''}
            `}
          >
            {theme === 'hacker'
              ? `SUCCESS: ${batchAnalyzeResult.success} | FAILED: ${batchAnalyzeResult.failed}`
              : `成功: ${batchAnalyzeResult.success} | 失败: ${batchAnalyzeResult.failed}`}
          </span>
        )}

        {/* 数量 */}
        <span
          className={`
            text-sm ml-auto
            ${theme === 'hacker' ? 'text-hacker-text-dim font-mono' : ''}
            ${theme === 'claude' ? 'text-claude-text-dim' : ''}
            ${theme === 'notion' ? 'text-notion-text-dim' : ''}
          `}
        >
          {activeTab === 'tapd'
            ? theme === 'hacker'
              ? tapdOwnerFilters.size > 0
                ? `// FILTERED: ${filteredStories.length}/${stories.length}`
                : `// TOTAL: ${stories.length}`
              : tapdOwnerFilters.size > 0
                ? `筛选 ${filteredStories.length}/${stories.length} 条需求`
                : `共 ${stories.length} 条需求`
            : theme === 'hacker'
              ? localOwnerFilters.size > 0
                ? `// FILTERED: ${filteredLocalFiles.length}/${localFiles.length}`
                : `// FILES: ${localFiles.length}`
              : localOwnerFilters.size > 0
                ? `筛选 ${filteredLocalFiles.length}/${localFiles.length} 个文件`
                : `共 ${localFiles.length} 个文件`}
        </span>
      </div>

      {/* 错误提示 */}
      {error && activeTab === 'tapd' && (
        <div
          className={`
            mb-4 p-3 rounded-md text-sm
            ${theme === 'hacker' ? 'bg-red-900/30 border border-red-500 text-red-400 font-mono' : ''}
            ${theme === 'claude' ? 'bg-red-50 border border-red-200 text-red-600' : ''}
            ${theme === 'notion' ? 'bg-red-50 border border-red-200 text-red-600' : ''}
          `}
        >
          {theme === 'hacker' ? `// ERROR: ${error}` : error}
        </div>
      )}

      {/* 主内容区 */}
      <div className="flex-1 flex gap-4 min-h-0">
        {activeTab === 'tapd' ? (
          <>
            {/* 需求列表 */}
            <div
              className={`
                flex-1 min-w-0 rounded-lg border overflow-hidden flex flex-col
                ${theme === 'hacker' ? 'bg-hacker-panel border-hacker-border' : ''}
                ${theme === 'claude' ? 'bg-claude-panel border-claude-border shadow-soft' : ''}
                ${theme === 'notion' ? 'bg-notion-panel border-notion-border shadow-soft' : ''}
              `}
            >
              <StoryTable
                theme={theme}
                stories={filteredStories}
                selectedId={selectedStory?.id}
                onSelect={(story) => loadStoryDetail(story.id)}
                loading={loading}
                selectedStoryIds={selectedStoryIds}
                onSelectionChange={setSelectedStoryIds}
              />
            </div>

            {/* 详情面板 */}
            {selectedStory && (
              <StoryDetailPanel
                theme={theme}
                story={selectedStory}
                loading={detailLoading}
                onClose={() => setSelectedStory(null)}
                onCreateFile={handleCreateFile}
                onAIImplement={handleAIImplement}
                creating={creating}
                createMessage={createMessage}
              />
            )}
          </>
        ) : (
          <>
            {/* 本地文件列表 */}
            <div
              className={`
                flex-1 min-w-0 rounded-lg border overflow-hidden flex flex-col
                ${theme === 'hacker' ? 'bg-hacker-panel border-hacker-border' : ''}
                ${theme === 'claude' ? 'bg-claude-panel border-claude-border shadow-soft' : ''}
                ${theme === 'notion' ? 'bg-notion-panel border-notion-border shadow-soft' : ''}
              `}
            >
              <LocalFileList
                theme={theme}
                files={filteredLocalFiles}
                selectedId={selectedFile?.id}
                onSelect={loadFileContent}
                onDelete={handleDeleteFile}
                loading={localLoading}
                requirementsDir={requirementsDir}
                selectedFileIds={selectedFileIds}
                onSelectionChange={setSelectedFileIds}
              />
            </div>

            {/* Markdown 编辑器 */}
            {selectedFile && (
              <MarkdownEditor
                theme={theme}
                filePath={selectedFile.path}
                filename={selectedFile.filename}
                initialContent={fileContent}
                storyId={selectedFile.storyId}
                storyTitle={selectedFile.title}
                batchAnalyzing={batchAnalyzing}
                isAnalyzing={analyzingFiles.get(selectedFile.id) || false}
                onAnalyzingChange={(analyzing) => setFileAnalyzing(selectedFile.id, analyzing)}
                onAIImplement={() => handleLocalFileAIImplement(selectedFile)}
                onClose={() => {
                  setSelectedFile(null);
                  setFileContent('');
                }}
                onSave={async (content) => {
                  const result = await window.electronAPI.file.save(selectedFile.path, content);
                  if (result.success) {
                    loadLocalFiles(); // Refresh file list to update modified time
                  }
                  return result.success;
                }}
              />
            )}
          </>
        )}
      </div>

      {/* AI 实现弹窗 */}
      <AIImplementModal
        isOpen={showAIModal}
        onClose={() => {
          setShowAIModal(false);
          setAIImplementStory(null);
          setAIImplementFile(null);
        }}
        onCreated={handleAIImplementCreated}
        requirementId={aiImplementStory?.id || aiImplementFile?.storyId}
        requirementTitle={aiImplementStory?.title || aiImplementFile?.title}
        requirementContent={aiImplementStory?.description}
        requirementsDir={requirementsDir}
      />
    </div>
  );
};

// 页面标题
const PageHeader: FC<{ theme: string }> = ({ theme }) => (
  <h2
    className={`
      text-xl font-semibold mb-4
      ${theme === 'hacker' ? 'text-hacker-text-main font-mono' : ''}
      ${theme === 'claude' ? 'text-claude-text-main' : ''}
      ${theme === 'notion' ? 'text-notion-text-main' : ''}
    `}
  >
    需求管理
  </h2>
);

// Tab 栏
const TabBar: FC<{
  theme: string;
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}> = ({ theme, activeTab, onTabChange }) => {
  const tabs: { id: TabType; label: string }[] = [
    { id: 'tapd', label: 'TAPD 需求' },
    { id: 'local', label: '本地文件' },
  ];

  return (
    <div
      className={`
        flex mb-4 border-b
        ${theme === 'hacker' ? 'border-hacker-border' : ''}
        ${theme === 'claude' ? 'border-claude-border' : ''}
        ${theme === 'notion' ? 'border-notion-border' : ''}
      `}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`
            px-4 py-2 text-sm transition-colors -mb-px border-b-2
            ${
              activeTab === tab.id
                ? theme === 'hacker'
                  ? 'text-hacker-primary border-hacker-primary font-mono'
                  : theme === 'claude'
                    ? 'text-claude-primary border-claude-primary'
                    : 'text-notion-primary border-notion-primary'
                : theme === 'hacker'
                  ? 'text-hacker-text-dim border-transparent hover:text-hacker-text-main font-mono'
                  : theme === 'claude'
                    ? 'text-claude-text-dim border-transparent hover:text-claude-text-main'
                    : 'text-notion-text-dim border-transparent hover:text-notion-text-main'
            }
          `}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

// 需求表格
const StoryTable: FC<{
  theme: string;
  stories: StorySummary[];
  selectedId?: string;
  onSelect: (story: StorySummary) => void;
  loading: boolean;
  selectedStoryIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
}> = ({ theme, stories, selectedId, onSelect, loading, selectedStoryIds, onSelectionChange }) => {
  // 全选状态
  const allSelected = stories.length > 0 && stories.every((s) => selectedStoryIds.has(s.id));
  const someSelected = stories.some((s) => selectedStoryIds.has(s.id)) && !allSelected;

  // 切换全选
  const handleToggleAll = () => {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(stories.map((s) => s.id)));
    }
  };

  // 切换单个选择
  const handleToggleOne = (storyId: string) => {
    const newSet = new Set(selectedStoryIds);
    if (newSet.has(storyId)) {
      newSet.delete(storyId);
    } else {
      newSet.add(storyId);
    }
    onSelectionChange(newSet);
  };

  if (loading && stories.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span
          className={`
            text-sm
            ${theme === 'hacker' ? 'text-hacker-text-dim font-mono' : ''}
            ${theme === 'claude' ? 'text-claude-text-dim' : ''}
            ${theme === 'notion' ? 'text-notion-text-dim' : ''}
          `}
        >
          {theme === 'hacker' ? 'LOADING...' : '加载中...'}
        </span>
      </div>
    );
  }

  if (stories.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span
          className={`
            text-sm
            ${theme === 'hacker' ? 'text-hacker-text-dim font-mono' : ''}
            ${theme === 'claude' ? 'text-claude-text-dim' : ''}
            ${theme === 'notion' ? 'text-notion-text-dim' : ''}
          `}
        >
          {theme === 'hacker' ? '// NO_DATA' : '暂无需求'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full min-w-[750px]">
        <thead
          className={`
            sticky top-0
            ${theme === 'hacker' ? 'bg-hacker-bg' : ''}
            ${theme === 'claude' ? 'bg-claude-bg' : ''}
            ${theme === 'notion' ? 'bg-notion-bg' : ''}
          `}
        >
          <tr
            className={`
              text-left text-sm whitespace-nowrap
              ${theme === 'hacker' ? 'text-hacker-text-dim font-mono border-b border-hacker-border' : ''}
              ${theme === 'claude' ? 'text-claude-text-dim border-b border-claude-border' : ''}
              ${theme === 'notion' ? 'text-notion-text-dim border-b border-notion-border' : ''}
            `}
          >
            <th className="px-3 py-3 font-medium w-10">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={handleToggleAll}
                className={`
                  w-4 h-4 rounded cursor-pointer
                  ${theme === 'hacker' ? 'accent-hacker-primary' : ''}
                  ${theme === 'claude' ? 'accent-claude-primary' : ''}
                  ${theme === 'notion' ? 'accent-notion-primary' : ''}
                `}
              />
            </th>
            <th className="px-4 py-3 font-medium w-24">ID</th>
            <th className="px-4 py-3 font-medium min-w-[200px]">标题</th>
            <th className="px-4 py-3 font-medium w-24">状态</th>
            <th className="px-4 py-3 font-medium w-28">负责人</th>
            <th className="px-4 py-3 font-medium w-28">更新时间</th>
          </tr>
        </thead>
        <tbody>
          {stories.map((story) => (
            <tr
              key={story.id}
              onClick={() => onSelect(story)}
              className={`
                cursor-pointer text-sm transition-colors whitespace-nowrap
                ${
                  selectedId === story.id
                    ? theme === 'hacker'
                      ? 'bg-hacker-primary/20'
                      : theme === 'claude'
                        ? 'bg-claude-primary/10'
                        : 'bg-notion-primary/10'
                    : ''
                }
                ${
                  theme === 'hacker'
                    ? 'hover:bg-hacker-primary/10 border-b border-hacker-border/50'
                    : ''
                }
                ${theme === 'claude' ? 'hover:bg-claude-bg border-b border-claude-border/50' : ''}
                ${theme === 'notion' ? 'hover:bg-notion-bg border-b border-notion-border/50' : ''}
              `}
            >
              <td className="px-3 py-3">
                <input
                  type="checkbox"
                  checked={selectedStoryIds.has(story.id)}
                  onChange={() => handleToggleOne(story.id)}
                  onClick={(e) => e.stopPropagation()}
                  className={`
                    w-4 h-4 rounded cursor-pointer
                    ${theme === 'hacker' ? 'accent-hacker-primary' : ''}
                    ${theme === 'claude' ? 'accent-claude-primary' : ''}
                    ${theme === 'notion' ? 'accent-notion-primary' : ''}
                  `}
                />
              </td>
              <td
                className={`
                  px-4 py-3
                  ${theme === 'hacker' ? 'text-hacker-text-dim font-mono' : ''}
                  ${theme === 'claude' ? 'text-claude-text-dim' : ''}
                  ${theme === 'notion' ? 'text-notion-text-dim' : ''}
                `}
              >
                {story.id}
              </td>
              <td
                className={`
                  px-4 py-3 min-w-[200px] max-w-[400px] truncate
                  ${theme === 'hacker' ? 'text-hacker-text-main font-mono' : ''}
                  ${theme === 'claude' ? 'text-claude-text-main' : ''}
                  ${theme === 'notion' ? 'text-notion-text-main' : ''}
                `}
              >
                {story.title}
              </td>
              <td className="px-4 py-3">
                <StatusBadge theme={theme} status={story.statusLabel || story.status} />
              </td>
              <td
                className={`
                  px-4 py-3
                  ${theme === 'hacker' ? 'text-hacker-text-main font-mono' : ''}
                  ${theme === 'claude' ? 'text-claude-text-main' : ''}
                  ${theme === 'notion' ? 'text-notion-text-main' : ''}
                `}
              >
                {story.owners.join(', ') || '-'}
              </td>
              <td
                className={`
                  px-4 py-3
                  ${theme === 'hacker' ? 'text-hacker-text-dim font-mono' : ''}
                  ${theme === 'claude' ? 'text-claude-text-dim' : ''}
                  ${theme === 'notion' ? 'text-notion-text-dim' : ''}
                `}
              >
                {story.updatedAt ? formatDate(story.updatedAt) : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// 本地文件列表
const LocalFileList: FC<{
  theme: string;
  files: LocalFile[];
  selectedId?: string;
  onSelect: (file: LocalFile) => void;
  onDelete: (file: LocalFile) => void;
  loading: boolean;
  requirementsDir: string;
  selectedFileIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
}> = ({ theme, files, selectedId, onSelect, onDelete, loading, requirementsDir, selectedFileIds, onSelectionChange }) => {
  // 全选状态
  const allSelected = files.length > 0 && files.every((f) => selectedFileIds.has(f.id));
  const someSelected = files.some((f) => selectedFileIds.has(f.id)) && !allSelected;

  // 切换全选
  const handleToggleAll = () => {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(files.map((f) => f.id)));
    }
  };

  // 切换单个选择
  const handleToggleOne = (fileId: string) => {
    const newSet = new Set(selectedFileIds);
    if (newSet.has(fileId)) {
      newSet.delete(fileId);
    } else {
      newSet.add(fileId);
    }
    onSelectionChange(newSet);
  };

  if (!requirementsDir) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p
            className={`
              text-sm mb-2
              ${theme === 'hacker' ? 'text-hacker-text-dim font-mono' : ''}
              ${theme === 'claude' ? 'text-claude-text-dim' : ''}
              ${theme === 'notion' ? 'text-notion-text-dim' : ''}
            `}
          >
            {theme === 'hacker' ? '// REQUIREMENTS_DIR_NOT_SET' : '需求文件目录未配置'}
          </p>
          <p
            className={`
              text-xs
              ${theme === 'hacker' ? 'text-hacker-text-dim font-mono' : ''}
              ${theme === 'claude' ? 'text-claude-text-dim' : ''}
              ${theme === 'notion' ? 'text-notion-text-dim' : ''}
            `}
          >
            {theme === 'hacker' ? '// Configure in SETTINGS' : '请前往设置页面配置'}
          </p>
        </div>
      </div>
    );
  }

  if (loading && files.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span
          className={`
            text-sm
            ${theme === 'hacker' ? 'text-hacker-text-dim font-mono' : ''}
            ${theme === 'claude' ? 'text-claude-text-dim' : ''}
            ${theme === 'notion' ? 'text-notion-text-dim' : ''}
          `}
        >
          {theme === 'hacker' ? 'LOADING...' : '加载中...'}
        </span>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span
          className={`
            text-sm
            ${theme === 'hacker' ? 'text-hacker-text-dim font-mono' : ''}
            ${theme === 'claude' ? 'text-claude-text-dim' : ''}
            ${theme === 'notion' ? 'text-notion-text-dim' : ''}
          `}
        >
          {theme === 'hacker' ? '// NO_FILES' : '暂无文件'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full min-w-[650px]">
        <thead
          className={`
            sticky top-0
            ${theme === 'hacker' ? 'bg-hacker-bg' : ''}
            ${theme === 'claude' ? 'bg-claude-bg' : ''}
            ${theme === 'notion' ? 'bg-notion-bg' : ''}
          `}
        >
          <tr
            className={`
              text-left text-sm whitespace-nowrap
              ${theme === 'hacker' ? 'text-hacker-text-dim font-mono border-b border-hacker-border' : ''}
              ${theme === 'claude' ? 'text-claude-text-dim border-b border-claude-border' : ''}
              ${theme === 'notion' ? 'text-notion-text-dim border-b border-notion-border' : ''}
            `}
          >
            <th className="px-3 py-3 font-medium w-10">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={handleToggleAll}
                className={`
                  w-4 h-4 rounded cursor-pointer
                  ${theme === 'hacker' ? 'accent-hacker-primary' : ''}
                  ${theme === 'claude' ? 'accent-claude-primary' : ''}
                  ${theme === 'notion' ? 'accent-notion-primary' : ''}
                `}
              />
            </th>
            <th className="px-4 py-3 font-medium w-40">文件名</th>
            <th className="px-4 py-3 font-medium min-w-[200px]">标题</th>
            <th className="px-4 py-3 font-medium w-28">负责人</th>
            <th className="px-4 py-3 font-medium w-28">修改时间</th>
            <th className="px-4 py-3 font-medium w-20">大小</th>
            <th className="px-4 py-3 font-medium w-16">操作</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr
              key={file.id}
              onClick={() => onSelect(file)}
              className={`
                cursor-pointer text-sm transition-colors whitespace-nowrap
                ${
                  selectedId === file.id
                    ? theme === 'hacker'
                      ? 'bg-hacker-primary/20'
                      : theme === 'claude'
                        ? 'bg-claude-primary/10'
                        : 'bg-notion-primary/10'
                    : ''
                }
                ${
                  theme === 'hacker'
                    ? 'hover:bg-hacker-primary/10 border-b border-hacker-border/50'
                    : ''
                }
                ${theme === 'claude' ? 'hover:bg-claude-bg border-b border-claude-border/50' : ''}
                ${theme === 'notion' ? 'hover:bg-notion-bg border-b border-notion-border/50' : ''}
              `}
            >
              <td className="px-3 py-3">
                <input
                  type="checkbox"
                  checked={selectedFileIds.has(file.id)}
                  onChange={() => handleToggleOne(file.id)}
                  onClick={(e) => e.stopPropagation()}
                  className={`
                    w-4 h-4 rounded cursor-pointer
                    ${theme === 'hacker' ? 'accent-hacker-primary' : ''}
                    ${theme === 'claude' ? 'accent-claude-primary' : ''}
                    ${theme === 'notion' ? 'accent-notion-primary' : ''}
                  `}
                />
              </td>
              <td
                className={`
                  px-4 py-3
                  ${theme === 'hacker' ? 'text-hacker-primary font-mono' : ''}
                  ${theme === 'claude' ? 'text-claude-primary' : ''}
                  ${theme === 'notion' ? 'text-notion-primary' : ''}
                `}
              >
                {file.filename}
              </td>
              <td
                className={`
                  px-4 py-3 min-w-[200px] max-w-[400px] truncate
                  ${theme === 'hacker' ? 'text-hacker-text-main font-mono' : ''}
                  ${theme === 'claude' ? 'text-claude-text-main' : ''}
                  ${theme === 'notion' ? 'text-notion-text-main' : ''}
                `}
              >
                {file.title}
              </td>
              <td
                className={`
                  px-4 py-3
                  ${theme === 'hacker' ? 'text-hacker-text-main font-mono' : ''}
                  ${theme === 'claude' ? 'text-claude-text-main' : ''}
                  ${theme === 'notion' ? 'text-notion-text-main' : ''}
                `}
              >
                {(file.owners || []).join(', ') || '-'}
              </td>
              <td
                className={`
                  px-4 py-3
                  ${theme === 'hacker' ? 'text-hacker-text-dim font-mono' : ''}
                  ${theme === 'claude' ? 'text-claude-text-dim' : ''}
                  ${theme === 'notion' ? 'text-notion-text-dim' : ''}
                `}
              >
                {formatDate(file.modifiedAt)}
              </td>
              <td
                className={`
                  px-4 py-3
                  ${theme === 'hacker' ? 'text-hacker-text-dim font-mono' : ''}
                  ${theme === 'claude' ? 'text-claude-text-dim' : ''}
                  ${theme === 'notion' ? 'text-notion-text-dim' : ''}
                `}
              >
                {formatSize(file.size)}
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(file);
                  }}
                  className={`
                    px-2 py-1 text-xs rounded transition-colors
                    ${theme === 'hacker' ? 'text-red-400 hover:bg-red-900/30 font-mono' : ''}
                    ${theme === 'claude' ? 'text-red-500 hover:bg-red-50' : ''}
                    ${theme === 'notion' ? 'text-red-500 hover:bg-red-50' : ''}
                  `}
                >
                  删除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// 状态徽章
const StatusBadge: FC<{ theme: string; status?: string | null }> = ({ theme, status }) => {
  if (!status) return <span>-</span>;

  const getStatusColor = () => {
    const s = status.toLowerCase();
    if (s.includes('完成') || s.includes('done') || s.includes('closed')) {
      return theme === 'hacker' ? 'bg-green-900/50 text-green-400' : 'bg-green-100 text-green-700';
    }
    if (s.includes('开发') || s.includes('dev') || s.includes('progress')) {
      return theme === 'hacker' ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-100 text-blue-700';
    }
    if (s.includes('测试') || s.includes('test')) {
      return theme === 'hacker'
        ? 'bg-purple-900/50 text-purple-400'
        : 'bg-purple-100 text-purple-700';
    }
    if (s.includes('待') || s.includes('pending') || s.includes('规划')) {
      return theme === 'hacker'
        ? 'bg-yellow-900/50 text-yellow-400'
        : 'bg-yellow-100 text-yellow-700';
    }
    return theme === 'hacker' ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600';
  };

  return (
    <span
      className={`
        inline-block px-2 py-0.5 rounded text-xs
        ${getStatusColor()}
        ${theme === 'hacker' ? 'font-mono' : ''}
      `}
    >
      {status}
    </span>
  );
};

// 需求详情面板
const StoryDetailPanel: FC<{
  theme: string;
  story: StoryDetail;
  loading: boolean;
  onClose: () => void;
  onCreateFile: (story: StoryDetail) => void;
  onAIImplement: (story: StoryDetail) => void;
  creating: boolean;
  createMessage: { type: 'success' | 'error'; text: string } | null;
}> = ({ theme, story, loading, onClose, onCreateFile, onAIImplement, creating, createMessage }) => {
  return (
    <div
      className={`
        w-[400px] flex-shrink-0 rounded-lg border flex flex-col
        ${theme === 'hacker' ? 'bg-hacker-panel border-hacker-border' : ''}
        ${theme === 'claude' ? 'bg-claude-panel border-claude-border shadow-soft' : ''}
        ${theme === 'notion' ? 'bg-notion-panel border-notion-border shadow-soft' : ''}
      `}
    >
      {/* 头部 */}
      <div
        className={`
          flex items-center justify-between px-4 py-3 border-b
          ${theme === 'hacker' ? 'border-hacker-border' : ''}
          ${theme === 'claude' ? 'border-claude-border' : ''}
          ${theme === 'notion' ? 'border-notion-border' : ''}
        `}
      >
        <h3
          className={`
            text-sm font-medium
            ${theme === 'hacker' ? 'text-hacker-primary font-mono' : ''}
            ${theme === 'claude' ? 'text-claude-text-main' : ''}
            ${theme === 'notion' ? 'text-notion-text-main' : ''}
          `}
        >
          {theme === 'hacker' ? '> DETAIL' : '需求详情'}
        </h3>
        <button
          onClick={onClose}
          className={`
            px-2 py-1 rounded hover:bg-opacity-10 text-lg leading-none
            ${theme === 'hacker' ? 'text-hacker-text-dim hover:bg-hacker-primary hover:text-hacker-primary' : ''}
            ${theme === 'claude' ? 'text-claude-text-dim hover:bg-claude-text-main' : ''}
            ${theme === 'notion' ? 'text-notion-text-dim hover:bg-notion-text-main' : ''}
          `}
        >
          ×
        </button>
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <span
              className={`
                text-sm
                ${theme === 'hacker' ? 'text-hacker-text-dim font-mono' : ''}
                ${theme === 'claude' ? 'text-claude-text-dim' : ''}
                ${theme === 'notion' ? 'text-notion-text-dim' : ''}
              `}
            >
              {theme === 'hacker' ? 'LOADING...' : '加载中...'}
            </span>
          </div>
        ) : (
          <>
            {/* 标题 */}
            <div>
              <h4
                className={`
                  text-base font-medium mb-2
                  ${theme === 'hacker' ? 'text-hacker-text-main font-mono' : ''}
                  ${theme === 'claude' ? 'text-claude-text-main' : ''}
                  ${theme === 'notion' ? 'text-notion-text-main' : ''}
                `}
              >
                {story.title}
              </h4>
              <div className="flex items-center gap-2">
                <StatusBadge theme={theme} status={story.statusLabel || story.status} />
                {story.url && (
                  <button
                    onClick={() => window.electronAPI.shell.openExternal(story.url!)}
                    className={`
                      text-xs hover:underline
                      ${theme === 'hacker' ? 'text-hacker-primary font-mono' : ''}
                      ${theme === 'claude' ? 'text-claude-primary' : ''}
                      ${theme === 'notion' ? 'text-notion-primary' : ''}
                    `}
                  >
                    {theme === 'hacker' ? '[OPEN_IN_TAPD]' : '在 TAPD 中打开'}
                  </button>
                )}
              </div>
            </div>

            {/* 创建文件按钮 */}
            <div className="space-y-2">
              <button
                onClick={() => onCreateFile(story)}
                disabled={creating}
                className={`
                  w-full px-4 py-2 rounded-md text-sm transition-colors
                  ${
                    theme === 'hacker'
                      ? 'bg-hacker-primary text-black hover:bg-hacker-primary/80 font-mono'
                      : ''
                  }
                  ${
                    theme === 'claude'
                      ? 'bg-claude-primary text-white hover:bg-claude-primary/90'
                      : ''
                  }
                  ${
                    theme === 'notion'
                      ? 'bg-notion-primary text-white hover:bg-notion-primary/90'
                      : ''
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                {creating ? (theme === 'hacker' ? 'CREATING...' : '创建中...') : '创建需求文件'}
              </button>

              {/* AI 实现按钮 */}
              <button
                onClick={() => onAIImplement(story)}
                className={`
                  w-full px-4 py-2 rounded-md text-sm transition-colors
                  ${
                    theme === 'hacker'
                      ? 'border border-hacker-primary text-hacker-primary hover:bg-hacker-primary hover:text-black font-mono'
                      : ''
                  }
                  ${
                    theme === 'claude'
                      ? 'border border-claude-primary text-claude-primary hover:bg-claude-primary hover:text-white'
                      : ''
                  }
                  ${
                    theme === 'notion'
                      ? 'border border-notion-primary text-notion-primary hover:bg-notion-primary hover:text-white'
                      : ''
                  }
                `}
              >
                {theme === 'hacker' ? '> AI 实现' : 'AI 实现'}
              </button>

              {createMessage && (
                <p
                  className={`
                    text-xs mt-2 text-center
                    ${
                      createMessage.type === 'success'
                        ? theme === 'hacker'
                          ? 'text-green-400'
                          : 'text-green-600'
                        : theme === 'hacker'
                          ? 'text-red-400'
                          : 'text-red-600'
                    }
                    ${theme === 'hacker' ? 'font-mono' : ''}
                  `}
                >
                  {createMessage.text}
                </p>
              )}
            </div>

            {/* 元信息 */}
            <div className="space-y-2">
              <InfoRow theme={theme} label="ID" value={story.id} />
              <InfoRow theme={theme} label="负责人" value={story.owners.join(', ') || '-'} />
              <InfoRow theme={theme} label="创建人" value={story.creator || '-'} />
              <InfoRow theme={theme} label="优先级" value={story.priority || '-'} />
              <InfoRow theme={theme} label="前端" value={story.frontend || '-'} />
              <InfoRow theme={theme} label="模块" value={story.module || '-'} />
              <InfoRow
                theme={theme}
                label="创建时间"
                value={story.createdAt ? formatDate(story.createdAt) : '-'}
              />
              <InfoRow
                theme={theme}
                label="更新时间"
                value={story.updatedAt ? formatDate(story.updatedAt) : '-'}
              />
            </div>

            {/* 描述 */}
            <div>
              <h5
                className={`
                  text-sm font-medium mb-2
                  ${theme === 'hacker' ? 'text-hacker-text-dim font-mono' : ''}
                  ${theme === 'claude' ? 'text-claude-text-dim' : ''}
                  ${theme === 'notion' ? 'text-notion-text-dim' : ''}
                `}
              >
                {theme === 'hacker' ? '// DESCRIPTION' : '描述'}
              </h5>
              <div
                className={`
                  text-sm p-3 rounded-md
                  ${theme === 'hacker' ? 'bg-hacker-bg text-hacker-text-main font-mono' : ''}
                  ${theme === 'claude' ? 'bg-claude-bg text-claude-text-main' : ''}
                  ${theme === 'notion' ? 'bg-notion-bg text-notion-text-main' : ''}
                `}
                dangerouslySetInnerHTML={{
                  __html:
                    story.description || (theme === 'hacker' ? '// NO_DESCRIPTION' : '暂无描述'),
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// 信息行
const InfoRow: FC<{ theme: string; label: string; value: string }> = ({ theme, label, value }) => (
  <div className="flex text-sm">
    <span
      className={`
        w-20 shrink-0
        ${theme === 'hacker' ? 'text-hacker-text-dim font-mono' : ''}
        ${theme === 'claude' ? 'text-claude-text-dim' : ''}
        ${theme === 'notion' ? 'text-notion-text-dim' : ''}
      `}
    >
      {label}
    </span>
    <span
      className={`
        ${theme === 'hacker' ? 'text-hacker-text-main font-mono' : ''}
        ${theme === 'claude' ? 'text-claude-text-main' : ''}
        ${theme === 'notion' ? 'text-notion-text-main' : ''}
      `}
    >
      {value}
    </span>
  </div>
);

// 格式化日期
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  } catch {
    return dateStr;
  }
}

// 格式化文件大小
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
