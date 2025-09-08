// src/application/WorkspaceWatcher.ts
import * as vscode from 'vscode';
import * as path from 'path';
import ignore, { Ignore } from 'ignore';
import { GenerationCoordinator } from './GenerationCoordinator';
import { FileSystem } from '../infrastructure/FileSystem';
import { Logger } from '../infrastructure/Logger';
import { RepoScribeConfig, BASE_CONFIG } from '../domain/config/types';
import { resolveConfig } from '../domain/config/resolver';

// Type alias for the dynamically imported debounce function.
type DebounceFnType = Awaited<typeof import('debounce-fn')>['default'];

/**
 * Manages the lifecycle of VS Code FileSystemWatchers for RepoScribe.
 * This class is responsible for efficiently watching for relevant file changes
 * and triggering the GenerationCoordinator.
 */
export class WorkspaceWatcher implements vscode.Disposable {
  private coordinator: GenerationCoordinator;
  private fs: FileSystem;
  private logger: Logger;
  private debounceFn: DebounceFnType | null = null;
  private workspaceRoot: string;
  private isPaused = false;

  private disposables: vscode.Disposable[] = [];
  private debouncedGenerate: (() => void) | null = null;

  constructor(
    coordinator: GenerationCoordinator,
    fs: FileSystem,
    logger: Logger,
    workspaceRoot: string
  ) {
    this.coordinator = coordinator;
    this.fs = fs;
    this.logger = logger;
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Sets the debounce function, which is loaded asynchronously.
   * @param debounceFn The debounce function implementation.
   */
  public setDebounceFn(debounceFn: DebounceFnType): void {
    this.debounceFn = debounceFn;
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

    // 1. Dispose of any existing watchers to prevent duplicates
    this.disposeWatchers();

    // 2. Resolve the current configuration to get the latest rules
    const config = await this.resolveCurrentConfig();
    this.logger.info(
      `Watchers re-initializing with output file: ${config.outputFile}`
    );

    // 3. Create the debounced generation function with the latest delay
    this.debouncedGenerate = this.debounceFn(
      () => this.coordinator.generate(),
      { wait: config.regenerationDelay }
    );

    // 4. Create a pre-filter based on the resolved config
    const preFilter = await this.createPreFilter(config);
    const relativeOutputFile = path.relative(
      this.workspaceRoot,
      path.join(this.workspaceRoot, config.outputFile)
    );

    // 5. Setup the watcher for configuration files (.reposcribe.json, .gitignore)
    const configWatcher = vscode.workspace.createFileSystemWatcher(
      '**/{.reposcribe.json,.gitignore}'
    );

    const onConfigChange = (uri: vscode.Uri) => {
      if (this.isPaused) {
        return;
      }
      this.logger.info(
        `Config file change detected (${path.basename(
          uri.fsPath
        )}), triggering immediate regeneration and watcher reset.`
      );
      // Immediately regenerate with new rules, then reset watchers to use them for future checks.
      this.coordinator.generate().then(() => this.resetWatchers());
    };
    configWatcher.onDidChange(onConfigChange);
    configWatcher.onDidCreate(onConfigChange);
    configWatcher.onDidDelete(onConfigChange);

    // 6. Setup the general file watcher for all other files
    const generalWatcher = vscode.workspace.createFileSystemWatcher(
      '**/*',
      false, // ignoreChangeEvents
      false, // ignoreCreateEvents
      false // ignoreDeleteEvents
    );

    const onGeneralChange = (uri: vscode.Uri) => {
      if (this.isPaused || !this.debouncedGenerate) {
        return;
      }

      const relativePath = path.relative(this.workspaceRoot, uri.fsPath);

      // Pre-filter: Ignore changes to the output file or any file matching ignore rules
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

    // 7. Store new watchers in disposables array for cleanup
    this.disposables.push(configWatcher, generalWatcher);
  }

  /**
   * Resolves the current RepoScribe configuration from the workspace.
   */
  private async resolveCurrentConfig(): Promise<RepoScribeConfig> {
    let userConfig: Partial<RepoScribeConfig> = {};
    const configUri = await this.fs.findFile('.reposcribe.json');
    if (configUri) {
      try {
        const content = await this.fs.readFile(configUri.fsPath);
        userConfig = JSON.parse(content);
      } catch (error) {
        this.logger.error(
          `Failed to read .reposcribe.json for watcher: ${
            (error as Error).message
          }`
        );
      }
    }
    return resolveConfig(BASE_CONFIG, userConfig);
  }

  /**
   * Creates an `ignore` instance pre-loaded with all exclusion rules.
   */
  private async createPreFilter(config: RepoScribeConfig): Promise<Ignore> {
    const gitignorePath = path.join(this.workspaceRoot, '.gitignore');
    let gitignoreContent = '';
    try {
      gitignoreContent = await this.fs.readFile(gitignorePath);
    } catch {
      // .gitignore not found, which is fine
    }

    const filter = ignore();
    filter.add(gitignoreContent);
    filter.add(config.exclude); // Add default and user-defined excludes

    // Handle include rules: if includes are present, ignore everything *not* included.
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
