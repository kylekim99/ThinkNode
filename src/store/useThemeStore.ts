import { create } from 'zustand';

export type ThemeName = 'light' | 'dark' | 'colorful';

export interface ThemeConfig {
  name: ThemeName;
  canvas: { bg: string; dotColor: string };
  node: {
    bg: string;
    border: string;
    text: string;
    selectedBorder: string;
    rootBg: string;
    rootBorder: string;
  };
  sidebar: { bg: string; border: string; text: string; hover: string };
  toolbar: { bg: string; border: string; text: string };
}

const themes: Record<ThemeName, ThemeConfig> = {
  light: {
    name: 'light',
    canvas: { bg: '#f8fafc', dotColor: '#e2e8f0' },
    node: {
      bg: '#ffffff',
      border: '#e2e8f0',
      text: '#1e293b',
      selectedBorder: '#3b82f6',
      rootBg: '#eff6ff',
      rootBorder: '#93c5fd',
    },
    sidebar: { bg: '#ffffff', border: '#e2e8f0', text: '#1e293b', hover: '#f1f5f9' },
    toolbar: { bg: '#ffffff', border: '#e2e8f0', text: '#334155' },
  },
  dark: {
    name: 'dark',
    canvas: { bg: '#1e1e2e', dotColor: '#3a3a4c' },
    node: {
      bg: '#2a2a3c',
      border: '#3a3a4c',
      text: '#e2e8f0',
      selectedBorder: '#60a5fa',
      rootBg: '#1e3a5f',
      rootBorder: '#60a5fa',
    },
    sidebar: { bg: '#1a1a2e', border: '#2a2a3c', text: '#e2e8f0', hover: '#2a2a3c' },
    toolbar: { bg: '#1a1a2e', border: '#2a2a3c', text: '#cbd5e1' },
  },
  colorful: {
    name: 'colorful',
    canvas: { bg: '#fefefe', dotColor: '#e0d4f5' },
    node: {
      bg: '#ffffff',
      border: '#a78bfa',
      text: '#1e293b',
      selectedBorder: '#7c3aed',
      rootBg: '#faf5ff',
      rootBorder: '#8b5cf6',
    },
    sidebar: { bg: '#faf5ff', border: '#e9d5ff', text: '#1e293b', hover: '#f3e8ff' },
    toolbar: { bg: '#faf5ff', border: '#e9d5ff', text: '#6d28d9' },
  },
};

// Colorful theme uses rotating border colors for non-root nodes
export const colorfulBorders = [
  '#3b82f6', // blue
  '#10b981', // green
  '#8b5cf6', // purple
  '#f59e0b', // orange
  '#ec4899', // pink
  '#06b6d4', // cyan
];

interface ThemeStore {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  getConfig: () => ThemeConfig;
}

function loadPersistedTheme(): ThemeName {
  try {
    const stored = localStorage.getItem('thinknode-theme');
    if (stored === 'light' || stored === 'dark' || stored === 'colorful') {
      return stored;
    }
  } catch {
    // localStorage unavailable
  }
  return 'light';
}

function applyThemeToDOM(themeName: ThemeName) {
  const config = themes[themeName];
  const root = document.documentElement;
  root.setAttribute('data-theme', themeName);

  // Set CSS custom properties
  root.style.setProperty('--canvas-bg', config.canvas.bg);
  root.style.setProperty('--canvas-dot', config.canvas.dotColor);
  root.style.setProperty('--node-bg', config.node.bg);
  root.style.setProperty('--node-border', config.node.border);
  root.style.setProperty('--node-text', config.node.text);
  root.style.setProperty('--node-selected-border', config.node.selectedBorder);
  root.style.setProperty('--node-root-bg', config.node.rootBg);
  root.style.setProperty('--node-root-border', config.node.rootBorder);
  root.style.setProperty('--sidebar-bg', config.sidebar.bg);
  root.style.setProperty('--sidebar-border', config.sidebar.border);
  root.style.setProperty('--sidebar-text', config.sidebar.text);
  root.style.setProperty('--sidebar-hover', config.sidebar.hover);
  root.style.setProperty('--toolbar-bg', config.toolbar.bg);
  root.style.setProperty('--toolbar-border', config.toolbar.border);
  root.style.setProperty('--toolbar-text', config.toolbar.text);
}

// Apply initial theme immediately
const initialTheme = loadPersistedTheme();
applyThemeToDOM(initialTheme);

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: initialTheme,

  setTheme: (theme: ThemeName) => {
    try {
      localStorage.setItem('thinknode-theme', theme);
    } catch {
      // localStorage unavailable
    }
    applyThemeToDOM(theme);
    set({ theme });
  },

  getConfig: () => {
    return themes[get().theme];
  },
}));
