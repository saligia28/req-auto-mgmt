/**
 * XTerminal Component
 * 基于 xterm.js 的终端组件，使用 IPC 与主进程通信
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';

interface XTerminalProps {
  sessionId: string;
  onReady?: () => void;
  onExit?: (exitCode: number) => void;
  className?: string;
}

// 终端主题配置
const themes = {
  claude: {
    background: '#1a1a2e',
    foreground: '#e0e0e0',
    cursor: '#cc785c',
    cursorAccent: '#1a1a2e',
    selectionBackground: '#cc785c40',
    black: '#1a1a2e',
    red: '#ff6b6b',
    green: '#4ecdc4',
    yellow: '#ffe66d',
    blue: '#4dabf7',
    magenta: '#cc785c',
    cyan: '#63e6be',
    white: '#e0e0e0',
    brightBlack: '#495057',
    brightRed: '#ff8787',
    brightGreen: '#69db7c',
    brightYellow: '#fff3bf',
    brightBlue: '#74c0fc',
    brightMagenta: '#e8a87c',
    brightCyan: '#96f2d7',
    brightWhite: '#ffffff',
  },
  notion: {
    background: '#ffffff',
    foreground: '#37352f',
    cursor: '#37352f',
    cursorAccent: '#ffffff',
    selectionBackground: '#2eaadc40',
    black: '#37352f',
    red: '#e03e3e',
    green: '#0f7b6c',
    yellow: '#dfab01',
    blue: '#0b6e99',
    magenta: '#6940a5',
    cyan: '#0f7b6c',
    white: '#f7f6f3',
    brightBlack: '#9b9a97',
    brightRed: '#ff7369',
    brightGreen: '#4dab9a',
    brightYellow: '#ffdc49',
    brightBlue: '#529cca',
    brightMagenta: '#9a6dd7',
    brightCyan: '#4dab9a',
    brightWhite: '#ffffff',
  },
  hacker: {
    background: '#0a0a0a',
    foreground: '#00ff00',
    cursor: '#00ff00',
    cursorAccent: '#0a0a0a',
    selectionBackground: '#00ff0040',
    black: '#0a0a0a',
    red: '#ff0000',
    green: '#00ff00',
    yellow: '#ffff00',
    blue: '#0000ff',
    magenta: '#ff00ff',
    cyan: '#00ffff',
    white: '#00ff00',
    brightBlack: '#003300',
    brightRed: '#ff3333',
    brightGreen: '#33ff33',
    brightYellow: '#ffff33',
    brightBlue: '#3333ff',
    brightMagenta: '#ff33ff',
    brightCyan: '#33ffff',
    brightWhite: '#ffffff',
  },
};

type ThemeType = keyof typeof themes;

export function XTerminal({ sessionId, onReady, onExit, className = '' }: XTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [, setConnected] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [terminalReady, setTerminalReady] = useState(false);

  // 使用 ref 存储回调，避免依赖项变化导致重复连接
  const onReadyRef = useRef(onReady);
  const onExitRef = useRef(onExit);
  const connectedSessionRef = useRef<string | null>(null);

  // 更新 ref
  useEffect(() => {
    onReadyRef.current = onReady;
    onExitRef.current = onExit;
  }, [onReady, onExit]);

  // 获取当前主题
  const getCurrentTheme = useCallback((): ThemeType => {
    const stored = localStorage.getItem('theme');
    if (stored && stored in themes) {
      return stored as ThemeType;
    }
    return 'claude';
  }, []);

  // 初始化终端
  useEffect(() => {
    if (!terminalRef.current) return;

    let aborted = false;
    let terminal: Terminal | null = null;
    let fitAddon: FitAddon | null = null;

    const currentTheme = getCurrentTheme();
    terminal = new Terminal({
      theme: themes[currentTheme],
      fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Menlo, Monaco, monospace',
      fontSize: 12,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 10000,
      allowProposedApi: true,
    });

    fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    const openTimer = setTimeout(() => {
      if (aborted || !terminalRef.current || !terminal) return;

      try {
        terminal.open(terminalRef.current);
        xtermRef.current = terminal;
        fitAddonRef.current = fitAddon;
        setTerminalReady(true);

        requestAnimationFrame(() => {
          if (aborted || !fitAddon) return;
          try {
            if (terminalRef.current && terminalRef.current.offsetWidth > 0) {
              fitAddon.fit();
            }
          } catch (err) {
            console.warn('[XTerminal] Initial fit failed:', err);
          }
        });
      } catch (err) {
        console.error('[XTerminal] Failed to open terminal:', err);
      }
    }, 0);

    // 窗口大小变化时调整终端
    const handleResize = () => {
      if (aborted) return;
      if (fitAddonRef.current && xtermRef.current) {
        try {
          fitAddonRef.current.fit();
          // 通过 IPC 发送新尺寸
          if (connectedSessionRef.current) {
            window.electronAPI.terminal.resize(
              connectedSessionRef.current,
              xtermRef.current.cols,
              xtermRef.current.rows
            );
          }
        } catch (err) {
          console.warn('[XTerminal] Resize fit failed:', err);
        }
      }
    };

    window.addEventListener('resize', handleResize);

    // 主题变化监听
    const handleStorageChange = (e: StorageEvent) => {
      if (aborted || !terminal) return;
      if (e.key === 'theme' && e.newValue && e.newValue in themes) {
        terminal.options.theme = themes[e.newValue as ThemeType];
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      aborted = true;
      clearTimeout(openTimer);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('storage', handleStorageChange);
      setTerminalReady(false);
      const terminalToDispose = terminal;
      setTimeout(() => {
        try {
          terminalToDispose?.dispose();
        } catch (err) {
          // Ignore dispose errors
        }
      }, 50);
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [getCurrentTheme]);

  // IPC 连接
  useEffect(() => {
    if (!sessionId || !terminalReady || !xtermRef.current) return;

    // 避免对同一个 session 重复连接
    if (connectedSessionRef.current === sessionId) {
      console.log('[XTerminal] Already connected to session:', sessionId);
      return;
    }

    let aborted = false;
    const terminal = xtermRef.current;

    // 清空终端
    if (connectedSessionRef.current === sessionId) {
      terminal.clear();
    }

    // 获取历史输出
    const loadHistory = async () => {
      try {
        const output = await window.electronAPI.terminal.getOutput(sessionId);
        if (!aborted && output) {
          terminal.write(output);
        }
      } catch (err) {
        console.error('[XTerminal] Failed to load history:', err);
      }
    };

    // 设置 IPC 监听
    const unsubscribeOutput = window.electronAPI.terminal.onOutput((data) => {
      if (aborted || data.sessionId !== sessionId) return;
      terminal.write(data.data);
    });

    const unsubscribeExit = window.electronAPI.terminal.onExit((data) => {
      if (aborted || data.sessionId !== sessionId) return;
      terminal.write(`\r\n\x1b[33m[进程已退出，退出码: ${data.exitCode}]\x1b[0m\r\n`);
      onExitRef.current?.(data.exitCode);
    });

    // 初始化连接
    connectedSessionRef.current = sessionId;
    setConnected(true);
    setError(null);

    // 发送初始尺寸
    window.electronAPI.terminal.resize(sessionId, terminal.cols, terminal.rows);

    // 加载历史输出
    loadHistory();

    onReadyRef.current?.();

    // 终端输入处理
    const inputDisposable = terminal.onData((data: string) => {
      window.electronAPI.terminal.write(sessionId, data);
    });

    return () => {
      aborted = true;
      inputDisposable.dispose();
      unsubscribeOutput();
      unsubscribeExit();
      connectedSessionRef.current = null;
    };
  }, [sessionId, terminalReady]);

  // 重新调整大小
  useEffect(() => {
    if (!terminalReady) return;
    const timer = setTimeout(() => {
      try {
        if (fitAddonRef.current && terminalRef.current && terminalRef.current.offsetWidth > 0) {
          fitAddonRef.current.fit();
        }
      } catch (err) {
        console.warn('[XTerminal] Delayed fit failed:', err);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [className, terminalReady]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div ref={terminalRef} className="w-full h-full" style={{ padding: '8px' }} />
    </div>
  );
}

export default XTerminal;
