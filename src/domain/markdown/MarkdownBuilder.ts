// src/domain/markdown/MarkdownBuilder.ts
import * as path from 'path';
import type { FileNode } from '../workspace/types';
import type { LanguageMap } from './types';

/**
 * A class responsible for constructing the final Markdown output string
 * from a project's file tree and content.
 */
export class MarkdownBuilder {
  /**
   * Orchestrates the entire build process for the final Markdown string.
   * @param tree The root FileNode of the project structure.
   * @param fileContents A map where keys are file paths and values are their string content.
   * @param languageMap A map of file extensions to language identifiers for syntax highlighting.
   * @returns The complete Markdown string ready to be written to a file.
   */
  public build(
    tree: FileNode,
    fileContents: Map<string, string>,
    languageMap: LanguageMap
  ): string {
    const parts: string[] = [];

    // 1. Main Header
    parts.push('# RepoScribe – Project Snapshot');
    parts.push('');

    // 2. Project Tree Section
    parts.push('## Project Tree');
    parts.push('');
    parts.push('```');
    parts.push(this.renderTree(tree));
    parts.push('```');
    parts.push('');

    // 3. Separator
    parts.push('---');
    parts.push('');

    // 4. File Contents Section
    parts.push('## File Contents');
    parts.push('');

    // 5. Individual File Content Blocks
    const sortedFiles = this.getFilesRecursive(tree);
    for (const fileNode of sortedFiles) {
      const content = fileContents.get(fileNode.path);
      if (content !== undefined) {
        parts.push(this.renderFileContent(fileNode.path, content, languageMap));
      }
    }

    return parts.join('\n');
  }

  /**
   * Recursively generates an ASCII-like tree representation from a FileNode structure.
   * @param root The root FileNode to render.
   * @returns A string representing the ASCII tree.
   */
  private renderTree(root: FileNode): string {
    const lines: string[] = [`<root>/`];
    const treeGenerator = (node: FileNode, prefix: string) => {
      const children = node.children;
      children.forEach((child, index) => {
        const isLast = index === children.length - 1;
        const connector = isLast ? '└── ' : '├── ';
        const childPrefix = prefix + (isLast ? '    ' : '│   ');

        const name = child.type === 'directory' ? `${child.name}/` : child.name;
        lines.push(`${prefix}${connector}${name}`);

        if (child.type === 'directory') {
          treeGenerator(child, childPrefix);
        }
      });
    };
    treeGenerator(root, '');
    return lines.join('\n');
  }

  /**
   * Formats a single file's content into a Markdown section with a fenced code block.
   * @param filePath The path of the file, used for the header.
   * @param content The string content of the file.
   * @param languageMap The map to resolve the language for syntax highlighting.
   * @returns A formatted Markdown string for one file.
   */
  private renderFileContent(
    filePath: string,
    content: string,
    languageMap: LanguageMap
  ): string {
    const ext = path.extname(filePath);
    const language = languageMap[ext] || 'plaintext';

    const header = `### \`${filePath}\``;
    const codeBlock = `\`\`\`\`${language}\n${content}\n\`\`\`\``;

    return `${header}\n\n${codeBlock}\n`;
  }

  /**
   * Performs a depth-first traversal of the tree to get a flat list of file nodes
   * in the correct sorted order.
   * @param node The node to start traversal from.
   * @returns A generator yielding file nodes.
   */
  private *getFilesRecursive(node: FileNode): Generator<FileNode> {
    for (const child of node.children) {
      if (child.type === 'file') {
        yield child;
      } else if (child.type === 'directory') {
        yield* this.getFilesRecursive(child);
      }
    }
  }
}
