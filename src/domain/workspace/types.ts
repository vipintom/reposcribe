// src/domain/workspace/types.ts
export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children: FileNode[];
}
