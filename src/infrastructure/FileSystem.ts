// src/infrastructure/FileSystem.ts
import * as vscode from 'vscode';
import * as path from 'path';

// Dynamically imported module type for caching
type FseType = typeof import('fs-extra');

/**
 * A wrapper around file system operations, using VS Code's workspace API
 * and fs-extra for enhanced reliability like atomic writes.
 */
export class FileSystem {
  private fse: FseType | null = null;

  private async getFsExtra(): Promise<FseType> {
    if (!this.fse) {
      this.fse = await import('fs-extra');
    }
    return this.fse;
  }

  /**
   * Retrieves file status information (e.g., size, type).
   * @param filePath The absolute path to the file.
   * @returns A promise that resolves to the file's stat object.
   */
  public async stat(filePath: string): Promise<vscode.FileStat> {
    const uri = vscode.Uri.file(filePath);
    return vscode.workspace.fs.stat(uri);
  }

  /**
   * Reads the content of a file using the VS Code workspace API.
   * @param filePath The absolute path to the file.
   * @returns A promise that resolves to the file's content as a string.
   */
  public async readFile(filePath: string): Promise<string> {
    const uri = vscode.Uri.file(filePath);
    const contentBytes = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(contentBytes).toString('utf8');
  }

  /**
   * Writes content to a file atomically to prevent corruption.
   * It writes to a temporary file first, then renames it upon successful completion.
   * @param filePath The absolute path to the target file.
   * @param content The content to write.
   */
  public async atomicWrite(filePath: string, content: string): Promise<void> {
    const fse = await this.getFsExtra();
    const tmpPath = `${filePath}.${Date.now()}.tmp`;
    try {
      await fse.outputFile(tmpPath, content, 'utf8');
      await fse.move(tmpPath, filePath, { overwrite: true });
    } catch (error) {
      // Clean up the temporary file on failure
      if (await fse.pathExists(tmpPath)) {
        await fse.remove(tmpPath);
      }
      throw error; // Re-throw the error to be handled by the caller
    }
  }

  /**
   * Ensures the output file path is listed in the .gitignore file.
   * If .gitignore does not exist, it will be created.
   * @param workspaceRoot The absolute path to the workspace root.
   * @param outputFile The relative path of the output file from the workspace root.
   */
  public async updateGitignore(
    workspaceRoot: string,
    outputFile: string
  ): Promise<void> {
    const gitignorePath = path.join(workspaceRoot, '.gitignore');
    const gitignoreUri = vscode.Uri.file(gitignorePath);
    let content = '';

    try {
      const contentBytes = await vscode.workspace.fs.readFile(gitignoreUri);
      content = Buffer.from(contentBytes).toString('utf8');
    } catch (error) {
      if (
        error instanceof vscode.FileSystemError &&
        error.code === 'FileNotFound'
      ) {
        // .gitignore does not exist, we will create it.
        content = '';
      } else {
        throw error; // Re-throw other errors
      }
    }

    const lines = content.split(/\r?\n/);
    if (!lines.includes(outputFile)) {
      const newContent =
        content.trim().length > 0
          ? `${content.trimEnd()}\n${outputFile}\n`
          : `${outputFile}\n`;
      await vscode.workspace.fs.writeFile(
        gitignoreUri,
        Buffer.from(newContent, 'utf8')
      );
    }
  }

  /**
   * Finds the first file in the workspace matching a glob pattern.
   * It prioritizes `.reposcribe.jsonc` over the legacy `.reposcribe.json`.
   * @param globPattern The glob pattern to search for (e.g., '.reposcribe.json').
   * @returns A promise that resolves to the Uri of the found file, or undefined if not found.
   */
  public async findFile(
    globPattern: '.reposcribe.json' | '.reposcribe.jsonc'
  ): Promise<vscode.Uri | undefined> {
    if (globPattern === '.reposcribe.jsonc') {
      const jsoncResults = await vscode.workspace.findFiles(
        '.reposcribe.jsonc',
        null,
        1
      );
      if (jsoncResults.length > 0) {
        return jsoncResults[0];
      }
    }

    const jsonResults = await vscode.workspace.findFiles(
      '.reposcribe.json',
      null,
      1
    );
    return jsonResults.length > 0 ? jsonResults[0] : undefined;
  }
}
