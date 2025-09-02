// src/domain/workspace/FileTree.ts
import type { FileNode } from './types';

/**
 * Recursively sorts the children of a FileNode.
 * Directories are placed first (alphabetically), followed by files (alphabetically).
 * @param node The FileNode to sort the children of.
 */
function sortTree(node: FileNode): void {
  if (node.children.length === 0) {
    return;
  }

  node.children.sort((a, b) => {
    // Directory vs. file
    if (a.type === 'directory' && b.type === 'file') {
      return -1;
    }
    if (a.type === 'file' && b.type === 'directory') {
      return 1;
    }
    // Both are same type, sort alphabetically by name
    return a.name.localeCompare(b.name);
  });

  // Recursively sort the children of directories
  for (const child of node.children) {
    if (child.type === 'directory') {
      sortTree(child);
    }
  }
}

/**
 * Constructs a hierarchical FileNode tree from a flat list of file paths.
 * The resulting tree is sorted with directories first, then files, at each level.
 *
 * @param filePaths A flat array of relative file paths.
 * @returns The root FileNode of the constructed tree.
 */
export function buildFileTree(filePaths: string[]): FileNode {
  const root: FileNode = {
    name: '<root>',
    path: '.',
    type: 'directory',
    children: [],
  };

  for (const path of filePaths) {
    const parts = path.split('/');
    let currentNode = root;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLastPart = i === parts.length - 1;

      // Construct the full path for the current part
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      let childNode = currentNode.children.find((child) => child.name === part);

      if (!childNode) {
        childNode = {
          name: part,
          path: currentPath,
          type: isLastPart ? 'file' : 'directory',
          children: [],
        };
        currentNode.children.push(childNode);
      }

      currentNode = childNode;
    }
  }

  sortTree(root);
  return root;
}
