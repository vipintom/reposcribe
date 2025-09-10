// src/application/GenerationCoordinator.ts
import * as vscode from 'vscode';
import * as path from 'path';
import { Logger } from '../infrastructure/Logger';
import { FileSystem } from '../infrastructure/FileSystem';
import { FileScanner } from '../infrastructure/FileScanner';
import { UIState, VSCodeUI } from '../infrastructure/VSCodeUI';
import { BASE_CONFIG } from '../domain/config/types';
import { buildFileTree } from '../domain/workspace/FileTree';
import { MarkdownBuilder } from '../domain/markdown/MarkdownBuilder';
import { ConfigurationService } from './ConfigurationService';

/**
 * Orchestrates the entire process of generating the project snapshot.
 * Connects the domain logic with the infrastructure services.
 */
export class GenerationCoordinator {
  private readonly logger: Logger;
  private readonly fs: FileSystem;
  private readonly scanner: FileScanner;
  private readonly ui: VSCodeUI;
  private readonly workspaceRoot: string;
  private readonly configService: ConfigurationService;
  private updateToIdleTimer: NodeJS.Timeout | undefined;

  /**
   * Creates an instance of the GenerationCoordinator.
   * @param logger The centralized logger instance.
   * @param fileSystem The file system abstraction layer.
   * @param fileScanner The file scanning and filtering service.
   * @param vscodeUI The UI management service for VS Code.
   * @param workspaceRoot The absolute path to the workspace root.
   * @param configService The centralized configuration service.
   */
  constructor(
    logger: Logger,
    fileSystem: FileSystem,
    fileScanner: FileScanner,
    vscodeUI: VSCodeUI,
    workspaceRoot: string,
    configService: ConfigurationService
  ) {
    this.logger = logger;
    this.fs = fileSystem;
    this.scanner = fileScanner;
    this.ui = vscodeUI;
    this.workspaceRoot = workspaceRoot;
    this.configService = configService;
  }

  /**
   * Executes the end-to-end generation process, from configuration to file output.
   * This method handles the main workflow and orchestrates all other services.
   */
  public async generate(): Promise<void> {
    if (this.updateToIdleTimer) {
      clearTimeout(this.updateToIdleTimer);
    }

    try {
      this.ui.updateStatus(UIState.GENERATING);
      this.logger.info('Generation process started.');

      // 1. Resolve config via the service
      const { resolvedConfig: finalConfig, userConfig } =
        await this.configService.getConfigContext();

      // 2. Read .gitignore
      const gitignorePath = path.join(this.workspaceRoot, '.gitignore');
      let gitignoreContent = '';
      try {
        gitignoreContent = await this.fs.readFile(gitignorePath);
        this.logger.info(`Loaded .gitignore from: ${gitignorePath}`);
      } catch {
        this.logger.info('.gitignore not found, proceeding without it.');
      }

      // 3. Scan for files using the new logic
      const absoluteFilePaths = await this.scanner.scan(
        this.workspaceRoot,
        BASE_CONFIG,
        userConfig,
        gitignoreContent
      );
      this.logger.info(
        `[SCAN] Found ${absoluteFilePaths.length} files to process.`
      );

      // 4. Build the file tree
      const relativeFilePaths = absoluteFilePaths.map((p) =>
        path.relative(this.workspaceRoot, p)
      );
      const tree = buildFileTree(relativeFilePaths);
      this.logger.info('File tree constructed.');

      // 5. Concurrently read all file contents
      const fileContents = new Map<string, string>();
      await Promise.all(
        absoluteFilePaths.map(async (filePath) => {
          const relativePath = path.relative(this.workspaceRoot, filePath);
          try {
            const stats = await this.fs.stat(filePath);
            if (
              finalConfig.maxFileSizeKb > 0 &&
              stats.size > finalConfig.maxFileSizeKb * 1024
            ) {
              const message = `[File content omitted: Exceeds ${finalConfig.maxFileSizeKb} KB size limit]`;
              fileContents.set(relativePath, message);
              this.logger.info(
                `Skipping content for "${relativePath}" due to size limit.`
              );
              return;
            }
            const content = await this.fs.readFile(filePath);
            fileContents.set(relativePath, content);
          } catch (error) {
            const errorMessage = `[Error reading file: ${
              (error as Error).message
            }]`;
            fileContents.set(relativePath, errorMessage);
            this.logger.warn(
              `Could not read file "${relativePath}". Content will be an error message.`
            );
          }
        })
      );
      this.logger.info(`Read content for ${fileContents.size} files.`);

      // 6. Build the final markdown string
      const markdownBuilder = new MarkdownBuilder();
      const markdownContent = markdownBuilder.build(
        tree,
        fileContents,
        finalConfig.languageMap
      );
      this.logger.info('Markdown content built.');

      // 7. Atomically write the output file
      const outputFilePath = path.join(
        this.workspaceRoot,
        finalConfig.outputFile
      );
      await this.fs.atomicWrite(outputFilePath, markdownContent);
      this.logger.info(
        `[WRITE] Output successfully written to ${finalConfig.outputFile}`
      );

      // 8. Update .gitignore
      await this.fs.updateGitignore(this.workspaceRoot, finalConfig.outputFile);

      // 9. Update UI to success state
      this.ui.updateStatus(UIState.UPDATED, new Date().toLocaleTimeString());
      this.logger.info('Generation process completed successfully.');

      // 10. Schedule transition back to IDLE state after a delay
      this.updateToIdleTimer = setTimeout(() => {
        this.ui.updateStatus(UIState.IDLE);
      }, 3000); // Revert to idle after 3 seconds
    } catch (error) {
      const err = error as Error;
      const errorMessage = `A critical error occurred: ${err.message}`;
      this.logger.error(`${errorMessage}\n${err.stack}`);
      this.ui.updateStatus(UIState.ERROR, 'Generation failed. Check logs.');
    }
  }

  /**
   * Generates a markdown snapshot for a selection of files/folders and returns it as a string.
   * @param selectedPaths An array of absolute paths for the selected items.
   * @returns A promise that resolves to the generated markdown string.
   */
  public async generateMarkdownForSelection(
    selectedPaths: string[]
  ): Promise<string> {
    this.logger.info(
      `Generating snapshot for selection of ${selectedPaths.length} items.`
    );

    const { resolvedConfig: finalConfig, userConfig } =
      await this.configService.getConfigContext();
    const gitignorePath = path.join(this.workspaceRoot, '.gitignore');
    let gitignoreContent = '';
    try {
      gitignoreContent = await this.fs.readFile(gitignorePath);
    } catch {
      /* ignore if not found */
    }

    const allWorkspaceFiles = await this.scanner.scan(
      this.workspaceRoot,
      BASE_CONFIG,
      userConfig,
      gitignoreContent
    );

    const fileStats = await Promise.all(
      selectedPaths.map((p) => this.fs.stat(p).catch(() => null))
    );
    const selectedDirs = selectedPaths.filter(
      (p, i) => fileStats[i]?.type === vscode.FileType.Directory
    );
    const selectedFiles = selectedPaths.filter(
      (p, i) => fileStats[i]?.type === vscode.FileType.File
    );

    const filesInSelection = new Set<string>();
    for (const dir of selectedDirs) {
      allWorkspaceFiles.forEach((file) => {
        if (file === dir || file.startsWith(dir + path.sep)) {
          filesInSelection.add(file);
        }
      });
    }
    for (const file of selectedFiles) {
      if (allWorkspaceFiles.includes(file)) {
        filesInSelection.add(file);
      }
    }

    const finalAbsolutePaths = Array.from(filesInSelection).sort();
    this.logger.info(
      `Filtered selection to ${finalAbsolutePaths.length} files.`
    );

    const relativeToWorkspacePaths = finalAbsolutePaths.map((p) =>
      path.relative(this.workspaceRoot, p)
    );
    const tree = buildFileTree(relativeToWorkspacePaths);

    const fileContents = new Map<string, string>();
    await Promise.all(
      finalAbsolutePaths.map(async (filePath) => {
        const relativePath = path.relative(this.workspaceRoot, filePath);
        try {
          const stats = await this.fs.stat(filePath);
          if (
            finalConfig.maxFileSizeKb > 0 &&
            stats.size > finalConfig.maxFileSizeKb * 1024
          ) {
            fileContents.set(
              relativePath,
              `[File content omitted: Exceeds ${finalConfig.maxFileSizeKb} KB size limit]`
            );
            return;
          }
          fileContents.set(relativePath, await this.fs.readFile(filePath));
        } catch (error) {
          fileContents.set(
            relativePath,
            `[Error reading file: ${(error as Error).message}]`
          );
        }
      })
    );

    const markdownBuilder = new MarkdownBuilder();
    return markdownBuilder.build(tree, fileContents, finalConfig.languageMap);
  }
}
