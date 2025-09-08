// src/application/GenerationCoordinator.ts
import * as path from 'path';
import { Logger } from '../infrastructure/Logger';
import { FileSystem } from '../infrastructure/FileSystem';
import { FileScanner } from '../infrastructure/FileScanner';
import { UIState, VSCodeUI } from '../infrastructure/VSCodeUI';
import { resolveConfig } from '../domain/config/resolver';
import { BASE_CONFIG, RepoScribeConfig } from '../domain/config/types';
import { buildFileTree } from '../domain/workspace/FileTree';
import { MarkdownBuilder } from '../domain/markdown/MarkdownBuilder';

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
  private updateToIdleTimer: NodeJS.Timeout | undefined;

  /**
   * Creates an instance of the GenerationCoordinator.
   * @param logger The centralized logger instance.
   * @param fileSystem The file system abstraction layer.
   * @param fileScanner The file scanning and filtering service.
   * @param vscodeUI The UI management service for VS Code.
   * @param workspaceRoot The absolute path to the workspace root.
   */
  constructor(
    logger: Logger,
    fileSystem: FileSystem,
    fileScanner: FileScanner,
    vscodeUI: VSCodeUI,
    workspaceRoot: string
  ) {
    this.logger = logger;
    this.fs = fileSystem;
    this.scanner = fileScanner;
    this.ui = vscodeUI;
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Resolves the RepoScribe configuration by reading from the workspace.
   * @returns A promise that resolves to the final, merged configuration.
   */
  private async resolveConfigFromWorkspace(): Promise<RepoScribeConfig> {
    this.logger.info('Resolving configuration from workspace files.');
    let userConfig: Partial<RepoScribeConfig> = {};
    const configUri = await this.fs.findFile('.reposcribe.json');
    if (configUri) {
      this.logger.info(`Found config file at: ${configUri.fsPath}`);
      try {
        const configContent = await this.fs.readFile(configUri.fsPath);
        userConfig = JSON.parse(configContent);
      } catch (error) {
        const errorMessage = `Failed to read or parse .reposcribe.json: ${
          (error as Error).message
        }`;
        this.logger.error(errorMessage);
        this.ui.updateStatus(UIState.ERROR, errorMessage);
        // Continue with base config
      }
    } else {
      this.logger.info('No .reposcribe.json found, using default settings.');
    }
    const resolved = resolveConfig(BASE_CONFIG, userConfig);
    this.logger.info('Configuration resolved successfully.');
    return resolved;
  }

  /**
   * Executes the end-to-end generation process, from configuration to file output.
   * This method handles the main workflow and orchestrates all other services.
   * @param initialConfig An optional, pre-resolved configuration to use. If not provided, it will be resolved from the workspace.
   */
  public async generate(initialConfig?: RepoScribeConfig): Promise<void> {
    // Clear any pending timer to switch to IDLE, as a new generation has started.
    if (this.updateToIdleTimer) {
      clearTimeout(this.updateToIdleTimer);
    }

    try {
      this.ui.updateStatus(UIState.GENERATING);
      this.logger.info('Generation process started.');

      // 1. Resolve config if not provided
      const finalConfig =
        initialConfig ?? (await this.resolveConfigFromWorkspace());
      if (initialConfig) {
        this.logger.info('Using pre-resolved configuration for initial run.');
      }

      // 2. Read .gitignore
      const gitignorePath = path.join(this.workspaceRoot, '.gitignore');
      let gitignoreContent = '';
      try {
        gitignoreContent = await this.fs.readFile(gitignorePath);
        this.logger.info(`Loaded .gitignore from: ${gitignorePath}`);
      } catch {
        this.logger.info('.gitignore not found, proceeding without it.');
      }

      // 3. Scan for files
      const absoluteFilePaths = await this.scanner.scan(
        this.workspaceRoot,
        finalConfig,
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
}
