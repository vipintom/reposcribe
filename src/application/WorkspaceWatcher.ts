// src/application/WorkspaceWatcher.ts
import * as vscode from 'vscode';
import * as path from 'path';
import { type Ignore } from 'ignore';
import { GenerationCoordinator } from './GenerationCoordinator';
import { FileSystem } from '../infrastructure/FileSystem';
import { Logger } from '../infrastructure/Logger';
import { RepoScribeConfig } from '../domain/config/types';
import { ConfigurationService } from './ConfigurationService';

// Type aliases for dynamically imported modules
type DebounceFnType = Awaited<typeof import('debounce-fn')>['default'];
type IgnoreFactory = typeof import('ignore');

/**
 * Manages the lifecycle of VS Code FileSystemWatchers for RepoScribe.
 * This class is responsible for efficiently watching for relevant file changes
 * and triggering the GenerationCoordinator.
 */
export class WorkspaceWatcher implements vscode.Disposable {
  private coordinator: GenerationCoordinator;
  private fs: FileSystem;
  private logger: Logger;
  private configService: ConfigurationService;
  private debounceFn: DebounceFnType | null = null;
  private ignore: IgnoreFactory | null = null;
  private workspaceRoot: string;
  private isPaused = false;

  private disposables: vscode.Disposable[] = [];
  private debouncedGenerate: (() => void) | null = null;

  constructor(
    coordinator: GenerationCoordinator,
    fs: FileSystem,
    logger: Logger,
    workspaceRoot: string,
    configService: ConfigurationService
  ) {
    this.coordinator = coordinator;
    this.fs = fs;
    this.logger = logger;
    this.workspaceRoot = workspaceRoot;
    this.configService = configService;
  }

  /**
   * Sets the debounce function, which is loaded asynchronously.
   * @param debounceFn The debounce function implementation.
   */
  public setDebounceFn(debounceFn: DebounceFnType): void {
    this.debounceFn = debounceFn;
  }

  private async getIgnoreFactory(): Promise<IgnoreFactory> {
    if (!this.ignore) {
      this.ignore = (await import('ignore')).default;
    }
    return this.ignore;
  }

  /**
   * Starts the file watching process.
   */
  public async initialize(): Promise<void> {
    await this.resetWatchers();
  }

  /**
   * Toggles the paused state of the watchers.
   * @param isPaused The new paused state.
   */
  public setPaused(isPaused: boolean): void {
    this.isPaused = isPaused;
  }

  /**
   * Clears existing watchers and sets up new ones based on the current configuration.
   * This is the core method for dynamically updating watch behavior.
   */
  private async resetWatchers(): Promise<void> {
    if (!this.debounceFn) {
      this.logger.error('Debounce function not set before watcher reset.');
      return;
    }

    this.disposeWatchers();

    const { resolvedConfig: config } =
      await this.configService.getConfigContext();
    this.logger.info(
      `Watchers re-initializing with output file: ${config.outputFile}`
    );

    this.debouncedGenerate = this.debounceFn(
      () => this.coordinator.generate(),
      { wait: config.regenerationDelay }
    );

    const preFilter = await this.createPreFilter(config);
    const relativeOutputFile = path.relative(
      this.workspaceRoot,
      path.join(this.workspaceRoot, config.outputFile)
    );

    const configWatcher = vscode.workspace.createFileSystemWatcher(
      '**/{.reposcribe.config.js,.gitignore}'
    );

    const onConfigChange = (uri: vscode.Uri) => {
      if (this.isPaused) {
        return;
      }
      this.logger.info(
        `Config file change detected (${path.basename(
          uri.fsPath
        )}), clearing cache and triggering regeneration.`
      );
      this.configService.clearCache();
      this.coordinator.generate().then(() => this.resetWatchers());
    };
    configWatcher.onDidChange(onConfigChange);
    configWatcher.onDidCreate(onConfigChange);
    configWatcher.onDidDelete(onConfigChange);

    const generalWatcher = vscode.workspace.createFileSystemWatcher('**/*');

    const onGeneralChange = (uri: vscode.Uri) => {
      if (this.isPaused || !this.debouncedGenerate) {
        return;
      }

      const relativePath = path.relative(this.workspaceRoot, uri.fsPath);

      if (
        relativePath === relativeOutputFile ||
        preFilter.ignores(relativePath)
      ) {
        return;
      }

      this.logger.info(
        `Relevant file change detected (${path.basename(
          uri.fsPath
        )}). Debouncing regeneration.`
      );
      this.debouncedGenerate();
    };
    generalWatcher.onDidChange(onGeneralChange);
    generalWatcher.onDidCreate(onGeneralChange);
    generalWatcher.onDidDelete(onGeneralChange);

    this.disposables.push(configWatcher, generalWatcher);
  }

  private async createPreFilter(config: RepoScribeConfig): Promise<Ignore> {
    const ignore = await this.getIgnoreFactory();
    const gitignorePath = path.join(this.workspaceRoot, '.gitignore');
    let gitignoreContent = '';
    try {
      gitignoreContent = await this.fs.readFile(gitignorePath);
    } catch {
      // .gitignore not found, which is fine
    }

    const filter = ignore();
    filter.add(gitignoreContent);
    filter.add(config.exclude);

    if (config.include && config.include.length > 0) {
      filter.add(['**/*', ...config.include.map((p) => `!${p}`)]);
    }

    return filter;
  }

  private disposeWatchers(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }

  public dispose(): void {
    this.disposeWatchers();
  }
}
