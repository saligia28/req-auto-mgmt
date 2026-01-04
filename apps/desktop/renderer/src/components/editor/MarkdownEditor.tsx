import { FC, useState, useCallback, useEffect, useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

interface MarkdownEditorProps {
  theme: string;
  filePath: string;
  filename: string;
  initialContent: string;
  onClose: () => void;
  onSave: (content: string) => Promise<boolean>;
  storyId?: string;
  storyTitle?: string;
  onAIImplement?: () => void;
}

// 从 Markdown 中提取需求描述内容（去除 AI 分析部分）
function extractRequirementContent(markdown: string): string {
  // 找到 AI 分析部分的开始位置
  const aiSectionRegex = /^---\s*\n+##\s*AI\s*分析/m;
  const match = markdown.match(aiSectionRegex);

  if (match && match.index !== undefined) {
    return markdown.substring(0, match.index).trim();
  }

  return markdown.trim();
}

// 格式化 AI 分析结果为 Markdown
function formatAnalysisResult(result: {
  summary: string;
  testCases: string[];
  analyzedAt: string;
  model: string;
  provider: string;
}): string {
  const lines: string[] = [];

  lines.push('---');
  lines.push('');
  lines.push('## AI 分析');
  lines.push('');
  lines.push(`> 分析时间: ${new Date(result.analyzedAt).toLocaleString()}`);
  lines.push(`> 使用模型: ${result.provider}/${result.model}`);
  lines.push('');

  if (result.summary) {
    lines.push('### 需求要点');
    lines.push('');
    lines.push(result.summary);
    lines.push('');
  }

  if (result.testCases && result.testCases.length > 0) {
    lines.push('### 测试用例建议');
    lines.push('');
    result.testCases.forEach((tc, index) => {
      lines.push(`${index + 1}. ${tc}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

export const MarkdownEditor: FC<MarkdownEditorProps> = ({
  theme,
  filePath,
  filename,
  initialContent,
  onClose,
  onSave,
  storyId: _storyId,
  storyTitle: _storyTitle,
  onAIImplement,
}) => {
  const [content, setContent] = useState(initialContent);
  const [originalContent, setOriginalContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeMessage, setAnalyzeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const hasChanges = content !== originalContent;

  // Update content when initialContent changes (e.g., switching files)
  useEffect(() => {
    setContent(initialContent);
    setOriginalContent(initialContent);
  }, [initialContent, filePath]);

  // Keyboard shortcut for save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (hasChanges && !saving) {
          handleSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasChanges, saving, content]);

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;
    editor.focus();
  };

  const handleChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      setContent(value);
    }
  }, []);

  const handleSave = async () => {
    if (!hasChanges || saving) return;

    try {
      setSaving(true);
      setSaveMessage(null);

      const success = await onSave(content);
      if (success) {
        setOriginalContent(content);
        setSaveMessage({
          type: 'success',
          text: '已保存',
        });
      } else {
        setSaveMessage({
          type: 'error',
          text: '保存失败',
        });
      }
    } catch (err) {
      setSaveMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setSaving(false);
      // Clear message after 2 seconds
      setTimeout(() => setSaveMessage(null), 2000);
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      const confirmText = theme === 'hacker'
        ? 'UNSAVED_CHANGES. DISCARD?'
        : '有未保存的更改，确定关闭？';
      if (!confirm(confirmText)) return;
    }
    onClose();
  };

  // AI 分析功能
  const handleAIAnalyze = async () => {
    if (analyzing) return;

    try {
      setAnalyzing(true);
      setAnalyzeMessage(null);

      // 提取需求内容（去除已有的 AI 分析部分）
      const requirementContent = extractRequirementContent(content);

      if (!requirementContent.trim()) {
        setAnalyzeMessage({
          type: 'error',
          text: '没有可分析的内容',
        });
        return;
      }

      // 调用 AI 分析 API
      if (!window.electronAPI?.ai?.analyze) {
        setAnalyzeMessage({
          type: 'error',
          text: 'AI 服务不可用',
        });
        return;
      }

      setAnalyzeMessage({
        type: 'success',
        text: '正在分析...',
      });

      const result = await window.electronAPI.ai.analyze(requirementContent);

      if (!result.success || !result.result) {
        setAnalyzeMessage({
          type: 'error',
          text: result.error || '分析失败',
        });
        return;
      }

      // 格式化分析结果
      const analysisMarkdown = formatAnalysisResult(result.result);

      // 合并内容
      const newContent = requirementContent + '\n\n' + analysisMarkdown;
      setContent(newContent);

      // 更新编辑器内容
      if (editorRef.current) {
        editorRef.current.setValue(newContent);
      }

      setAnalyzeMessage({
        type: 'success',
        text: '分析完成',
      });

      // 清除消息
      setTimeout(() => setAnalyzeMessage(null), 3000);
    } catch (err) {
      setAnalyzeMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setAnalyzing(false);
    }
  };

  // Determine Monaco theme based on app theme
  const getEditorTheme = () => {
    if (theme === 'hacker') return 'vs-dark';
    return 'light';
  };

  return (
    <div
      className={`
        w-[600px] flex-shrink-0 rounded-lg border flex flex-col
        ${theme === 'hacker' ? 'bg-hacker-panel border-hacker-border' : ''}
        ${theme === 'claude' ? 'bg-claude-panel border-claude-border shadow-soft' : ''}
        ${theme === 'notion' ? 'bg-notion-panel border-notion-border shadow-soft' : ''}
      `}
    >
      {/* Header */}
      <div
        className={`
          flex items-center justify-between px-4 py-3 border-b
          ${theme === 'hacker' ? 'border-hacker-border' : ''}
          ${theme === 'claude' ? 'border-claude-border' : ''}
          ${theme === 'notion' ? 'border-notion-border' : ''}
        `}
      >
        <div className="flex items-center gap-2">
          <h3
            className={`
              text-sm font-medium
              ${theme === 'hacker' ? 'text-hacker-primary font-mono' : ''}
              ${theme === 'claude' ? 'text-claude-text-main' : ''}
              ${theme === 'notion' ? 'text-notion-text-main' : ''}
            `}
          >
            {filename}
          </h3>
          {hasChanges && (
            <span
              className={`
                text-xs px-1.5 py-0.5 rounded
                ${theme === 'hacker' ? 'bg-yellow-900/50 text-yellow-400 font-mono' : ''}
                ${theme === 'claude' ? 'bg-yellow-100 text-yellow-700' : ''}
                ${theme === 'notion' ? 'bg-yellow-100 text-yellow-700' : ''}
              `}
            >
              已修改
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Save message */}
          {saveMessage && (
            <span
              className={`
                text-xs
                ${saveMessage.type === 'success'
                  ? theme === 'hacker' ? 'text-green-400' : 'text-green-600'
                  : theme === 'hacker' ? 'text-red-400' : 'text-red-600'
                }
                ${theme === 'hacker' ? 'font-mono' : ''}
              `}
            >
              {saveMessage.text}
            </span>
          )}
          {/* Analyze message */}
          {analyzeMessage && (
            <span
              className={`
                text-xs
                ${analyzeMessage.type === 'success'
                  ? theme === 'hacker' ? 'text-green-400' : 'text-green-600'
                  : theme === 'hacker' ? 'text-red-400' : 'text-red-600'
                }
                ${theme === 'hacker' ? 'font-mono' : ''}
              `}
            >
              {analyzeMessage.text}
            </span>
          )}
          {/* AI Analyze button */}
          <button
            onClick={handleAIAnalyze}
            disabled={analyzing}
            className={`
              px-3 py-1.5 rounded-md text-xs transition-colors
              ${theme === 'hacker'
                ? 'border border-hacker-border text-hacker-text-main hover:border-hacker-primary hover:text-hacker-primary font-mono'
                : ''
              }
              ${theme === 'claude'
                ? 'border border-claude-border text-claude-text-dim hover:border-claude-primary hover:text-claude-primary'
                : ''
              }
              ${theme === 'notion'
                ? 'border border-notion-border text-notion-text-dim hover:border-notion-primary hover:text-notion-primary'
                : ''
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            title="AI 分析需求"
          >
            {analyzing
              ? (theme === 'hacker' ? '分析中...' : '分析中...')
              : (theme === 'hacker' ? '[AI 分析]' : 'AI 分析')
            }
          </button>
          {/* AI Implement button */}
          {onAIImplement && (
            <button
              onClick={onAIImplement}
              className={`
                px-3 py-1.5 rounded-md text-xs transition-colors
                ${theme === 'hacker'
                  ? 'border border-hacker-primary text-hacker-primary hover:bg-hacker-primary hover:text-black font-mono'
                  : ''
                }
                ${theme === 'claude'
                  ? 'border border-claude-primary text-claude-primary hover:bg-claude-primary hover:text-white'
                  : ''
                }
                ${theme === 'notion'
                  ? 'border border-notion-primary text-notion-primary hover:bg-notion-primary hover:text-white'
                  : ''
                }
              `}
              title="AI 实现需求"
            >
              {theme === 'hacker' ? '> AI 实现' : 'AI 实现'}
            </button>
          )}
          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={`
              px-3 py-1.5 rounded-md text-xs transition-colors
              ${theme === 'hacker'
                ? 'bg-hacker-primary text-black hover:bg-hacker-primary/80 font-mono'
                : ''
              }
              ${theme === 'claude'
                ? 'bg-claude-primary text-white hover:bg-claude-primary/90'
                : ''
              }
              ${theme === 'notion'
                ? 'bg-notion-primary text-white hover:bg-notion-primary/90'
                : ''
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {saving ? '保存中...' : '保存'}
          </button>
          <button
            onClick={handleClose}
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
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-[400px]">
        <Editor
          height="100%"
          defaultLanguage="markdown"
          value={content}
          onChange={handleChange}
          onMount={handleEditorMount}
          theme={getEditorTheme()}
          options={{
            fontSize: 14,
            fontFamily: theme === 'hacker' ? "'JetBrains Mono', 'Fira Code', monospace" : "'SF Pro Text', -apple-system, sans-serif",
            lineNumbers: 'on',
            minimap: { enabled: false },
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            padding: { top: 16, bottom: 16 },
            renderLineHighlight: 'line',
            cursorBlinking: 'smooth',
            tabSize: 2,
            automaticLayout: true,
            lineHeight: 1.6,
          }}
        />
      </div>

      {/* Footer */}
      <div
        className={`
          px-4 py-2 border-t text-xs
          ${theme === 'hacker' ? 'border-hacker-border text-hacker-text-dim font-mono' : ''}
          ${theme === 'claude' ? 'border-claude-border text-claude-text-dim' : ''}
          ${theme === 'notion' ? 'border-notion-border text-notion-text-dim' : ''}
        `}
      >
        {theme === 'hacker' ? `// PATH: ${filePath}` : filePath}
      </div>
    </div>
  );
};
