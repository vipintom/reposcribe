// src/domain/config/types.ts
import type { LanguageMap } from '../markdown/types';

export interface RepoScribeConfig {
  outputFile: string;
  include: string[];
  exclude: string[];
  languageMap: LanguageMap;
  regenerationDelay: number;
}

/**
 * The base configuration containing default values for RepoScribe.
 * This is merged with the user's .reposcribe.json configuration.
 */
export const BASE_CONFIG: RepoScribeConfig = {
  outputFile: 'PROJECT_STRUCTURE.md',
  include: [],
  exclude: [
    // General
    '**/node_modules/**',
    '**/.git/**',
    '**/.vscode/**',
    '**/.idea/**',
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',

    // Binaries & Media
    '**/*.png',
    '**/*.jpg',
    '**/*.jpeg',
    '**/*.gif',
    '**/*.svg',
    '**/*.ico',
    '**/*.webp',
    '**/*.pdf',
    '**/*.zip',
    '**/*.tar.gz',
    '**/*.rar',
    '**/*.7z',
    '**/*.woff',
    '**/*.woff2',
    '**/*.eot',
    '**/*.ttf',
    '**/*.otf',
    '**/*.mp3',
    '**/*.mp4',
    '**/*.webm',
    '**/*.avi',
    '**/*.mov',

    // Lock files
    '**/package-lock.json',
    '**/pnpm-lock.yaml',
    '**/yarn.lock',
    '**/composer.lock',
  ],
  languageMap: {
    '.js': 'javascript',
    '.jsx': 'jsx',
    '.ts': 'typescript',
    '.tsx': 'tsx',
    '.json': 'json',
    '.md': 'markdown',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.less': 'less',
    '.py': 'python',
    '.java': 'java',
    '.go': 'go',
    '.rs': 'rust',
    '.rb': 'ruby',
    '.php': 'php',
    '.cs': 'csharp',
    '.sh': 'shell',
    '.yml': 'yaml',
    '.yaml': 'yaml',
    '.xml': 'xml',
    '.sql': 'sql',
    '.graphql': 'graphql',
    '.dockerfile': 'dockerfile',
    '.gitignore': 'gitignore',
  },
  regenerationDelay: 1500,
};
