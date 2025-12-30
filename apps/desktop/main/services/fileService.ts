/**
 * File Service
 * Manages requirement Markdown files
 */

import * as fs from 'fs';
import * as path from 'path';
import type { StoryDetail } from './tapdService';

export interface RequirementFile {
  id: string;
  filename: string;
  path: string;
  title: string;
  storyId: string;
  createdAt: string;
  modifiedAt: string;
  size: number;
}

export interface CreateFileOptions {
  story: StoryDetail;
  directory: string;
}

export interface CreateFilesResult {
  success: boolean;
  created: string[];
  skipped: string[];
  errors: { id: string; error: string }[];
}

/**
 * Strip HTML tags and decode HTML entities
 */
function stripHtml(html: string): string {
  if (!html) return '';

  // Decode HTML entities
  const entities: Record<string, string> = {
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
  };

  let text = html;
  for (const [entity, char] of Object.entries(entities)) {
    text = text.split(entity).join(char);
  }

  // Handle numeric entities
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));

  // Strip HTML tags, preserving some structure
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<li[^>]*>/gi, '- ');
  text = text.replace(/<h[1-6][^>]*>/gi, '\n## ');
  text = text.replace(/<\/h[1-6]>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');

  // Clean up extra whitespace
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();

  return text;
}

/**
 * Generate Markdown content from story detail
 */
function generateMarkdownContent(story: StoryDetail): string {
  const lines: string[] = [];

  // Title
  lines.push(`# ${story.title}`);
  lines.push('');

  // Meta info
  lines.push('## 基本信息');
  lines.push('');
  lines.push(`- **需求ID**: ${story.id}`);
  if (story.statusLabel) {
    lines.push(`- **状态**: ${story.statusLabel}`);
  }
  if (story.owners && story.owners.length > 0) {
    lines.push(`- **负责人**: ${story.owners.join(', ')}`);
  }
  if (story.priority) {
    lines.push(`- **优先级**: ${story.priority}`);
  }
  if (story.creator) {
    lines.push(`- **创建人**: ${story.creator}`);
  }
  if (story.createdAt) {
    lines.push(`- **创建时间**: ${story.createdAt}`);
  }
  if (story.url) {
    lines.push(`- **TAPD链接**: [查看详情](${story.url})`);
  }
  lines.push('');

  // Description
  lines.push('## 需求描述');
  lines.push('');
  if (story.description) {
    const description = stripHtml(story.description);
    lines.push(description);
  } else {
    lines.push('*暂无描述*');
  }
  lines.push('');

  // Placeholders for AI analysis
  lines.push('---');
  lines.push('');
  lines.push('## AI 分析');
  lines.push('');
  lines.push('*等待 AI 分析...*');
  lines.push('');
  lines.push('### 需求要点');
  lines.push('');
  lines.push('### 测试用例建议');
  lines.push('');

  return lines.join('\n');
}

class FileService {
  /**
   * Ensure directory exists
   */
  private ensureDirectory(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Generate filename from story ID
   */
  private getFilename(storyId: string): string {
    return `${storyId}.md`;
  }

  /**
   * Create a requirement Markdown file
   */
  async createFile(options: CreateFileOptions): Promise<{ success: boolean; path?: string; error?: string }> {
    const { story, directory } = options;

    try {
      this.ensureDirectory(directory);

      const filename = this.getFilename(story.id);
      const filePath = path.join(directory, filename);

      // Check if file already exists
      if (fs.existsSync(filePath)) {
        return { success: false, error: '文件已存在' };
      }

      // Generate content
      const content = generateMarkdownContent(story);

      // Write file
      fs.writeFileSync(filePath, content, 'utf-8');

      return { success: true, path: filePath };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error };
    }
  }

  /**
   * Create multiple requirement files (batch)
   */
  async createFiles(stories: StoryDetail[], directory: string): Promise<CreateFilesResult> {
    const result: CreateFilesResult = {
      success: true,
      created: [],
      skipped: [],
      errors: [],
    };

    this.ensureDirectory(directory);

    for (const story of stories) {
      const createResult = await this.createFile({ story, directory });

      if (createResult.success && createResult.path) {
        result.created.push(story.id);
      } else if (createResult.error === '文件已存在') {
        result.skipped.push(story.id);
      } else {
        result.errors.push({ id: story.id, error: createResult.error || 'Unknown error' });
        result.success = false;
      }
    }

    return result;
  }

  /**
   * List requirement files in directory
   */
  async listFiles(directory: string): Promise<RequirementFile[]> {
    if (!directory || !fs.existsSync(directory)) {
      return [];
    }

    try {
      const files = fs.readdirSync(directory);
      const result: RequirementFile[] = [];

      for (const filename of files) {
        if (!filename.endsWith('.md')) continue;

        const filePath = path.join(directory, filename);
        const stats = fs.statSync(filePath);

        if (!stats.isFile()) continue;

        // Extract story ID from filename
        const storyId = filename.replace('.md', '');

        // Read first line for title
        let title = storyId;
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const firstLine = content.split('\n')[0];
          if (firstLine.startsWith('# ')) {
            title = firstLine.substring(2).trim();
          }
        } catch {
          // Ignore read errors
        }

        result.push({
          id: filename,
          filename,
          path: filePath,
          title,
          storyId,
          createdAt: stats.birthtime.toISOString(),
          modifiedAt: stats.mtime.toISOString(),
          size: stats.size,
        });
      }

      // Sort by modification time (newest first)
      result.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());

      return result;
    } catch (err) {
      console.error('[FileService] Error listing files:', err);
      return [];
    }
  }

  /**
   * Read file content
   */
  async readFile(filePath: string): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: '文件不存在' };
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      return { success: true, content };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error };
    }
  }

  /**
   * Save file content
   */
  async saveFile(filePath: string, content: string): Promise<{ success: boolean; error?: string }> {
    try {
      const dir = path.dirname(filePath);
      this.ensureDirectory(dir);

      fs.writeFileSync(filePath, content, 'utf-8');
      return { success: true };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error };
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(filePath: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: '文件不存在' };
      }

      fs.unlinkSync(filePath);
      return { success: true };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error };
    }
  }

  /**
   * Check if file exists
   */
  fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  /**
   * Get file path for a story
   */
  getStoryFilePath(directory: string, storyId: string): string {
    return path.join(directory, this.getFilename(storyId));
  }
}

// Singleton
export const fileService = new FileService();
