// src/domain/config/types.ts
import type { LanguageMap } from '../markdown/types';

export interface RepoScribeConfig {
  outputFile: string;
  include: string[];
  exclude: string[];
  languageMap: LanguageMap;
  regenerationDelay: number;
  maxFileSizeKb: number;
}

/**
 * DEVELOPMENT POLICY:
 * To ensure backward compatibility, any new property added to the
 * `RepoScribeConfig` interface MUST also be given a default value in this
 * `BASE_CONFIG` object. This prevents the extension from breaking for users
 * who have an existing `.reposcribe.jsonc` file that does not yet include
 * the new property.
 *
 * The `resolveConfig` function relies on this principle to merge user
 * settings over a complete set of defaults.
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
    '**/*.log',
    '**/.history/**',

    // Python
    '**/__pycache__/**',
    '**/*.pyc',
    '**/*.pyo',
    '**/*.pyd',
    '**/.pytest_cache/**',
    '**/venv/**',
    '**/.venv/**',
    '**/env/**',
    '**/.env',
    '**/instance/**',
    '**/*.egg-info/**',

    // Databases & Caches
    '**/*cache/**',
    '**/.cache/**',
    '**/*.db',
    '**/*.db-wal',
    '**/*.db-shm',
    '**/*.sqlitedb',
    '**/*.tmp',
    '**/*.db-journal',

    // Compiled Artifacts
    '**/*.class',
    '**/*.jar',
    '**/*.war',
    '**/*.ear',
    '**/*.dll',
    '**/*.exe',
    '**/*.o',
    '**/*.so',
    '**/*.a',

    // Compressed Archives
    '**/*.zip',
    '**/*.tar',
    '**/*.tar.gz',
    '**/*.rar',
    '**/*.7z',
    '**/*.bz2',

    // Documents
    '**/*.pdf',
    '**/*.doc',
    '**/*.docx',
    '**/*.xls',
    '**/*.xlsx',
    '**/*.ppt',
    '**/*.pptx',

    // Media & Images
    '**/*.png',
    '**/*.jpg',
    '**/*.jpeg',
    '**/*.gif',
    '**/*.svg',
    '**/*.ico',
    '**/*.webp',
    '**/*.mov',
    '**/*.mp4',
    '**/*.avi',
    '**/*.webm',
    '**/*.mp3',
    '**/*.wav',
    '**/*.flac',
    '**/*.psd',
    '**/*.ai',
    '**/*.eps',

    // Fonts
    '**/*.woff',
    '**/*.woff2',
    '**/*.eot',
    '**/*.ttf',
    '**/*.otf',

    // Disk Images & VMs
    '**/*.iso',
    '**/*.vmdk',
    '**/*.vdi',

    // Lock files
    '**/package-lock.json',
    '**/pnpm-lock.yaml',
    '**/yarn.lock',
    '**/composer.lock',
    '**/uv.lock',
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
  maxFileSizeKb: 2048,
};
