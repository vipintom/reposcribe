// src/extension.ts
import * as vscode from 'vscode';
import { Logger } from './infrastructure/Logger';
import { FileSystem } from './infrastructure/FileSystem';
import { FileScanner } from './infrastructure/FileScanner';
import { UIState, VSCodeUI } from './infrastructure/VSCodeUI';
import { GenerationCoordinator } from './application/GenerationCoordinator';
import { WorkspaceWatcher } from './application/WorkspaceWatcher';
import { CommandRegistry } from './application/CommandRegistry';
import { RepoScribeConfig, BASE_CONFIG } from './domain/config/types';
import { resolveConfig } from './domain/config/resolver';

/**
 * This method is called when the extension is activated.
 * Its sole purpose is to instantiate and wire up all application services.
 */
export async function activate(context: vscode.ExtensionContext) {
  const { default: debounceFn } = await import('debounce-fn');

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage(
      'RepoScribe requires an open folder to work.'
    );
    return;
  }
  const workspaceRoot = workspaceFolders[0].uri.fsPath;

  // 1. Instantiate services
  const logger = new Logger('RepoScribe');
  const fs = new FileSystem();
  const fileScanner = new FileScanner();
  const ui = new VSCodeUI('reposcribe.copyFileContent'); // Default click action

  const coordinator = new GenerationCoordinator(
    logger,
    fs,
    fileScanner,
    ui,
    workspaceRoot
  );

  const workspaceWatcher = new WorkspaceWatcher(
    coordinator,
    fs,
    logger,
    debounceFn,
    workspaceRoot
  );

  // 2. Register all commands
  CommandRegistry.register(
    context,
    fs,
    workspaceRoot,
    coordinator,
    logger,
    ui,
    workspaceWatcher
  );

  // 3. Initialize the watcher
  workspaceWatcher.initialize();

  // 4. Add services to subscriptions for cleanup
  context.subscriptions.push(logger, ui, workspaceWatcher);

  // 5. Set initial UI state and kick off the first run in the background
  ui.updateStatus(UIState.IDLE);
  runInitialGeneration(coordinator, fs, logger);
}

/**
 * Performs the initial, potentially slow, setup and generation task.
 * This is run as a non-blocking background process to ensure fast activation.
 */
async function runInitialGeneration(
  coordinator: GenerationCoordinator,
  fs: FileSystem,
  logger: Logger
): Promise<void> {
  // Resolve the config needed for the first run.
  logger.info('Performing initial configuration resolution for first run.');
  let userConfig: Partial<RepoScribeConfig> = {};
  const configUri = await fs.findFile('.reposcribe.json');
  if (configUri) {
    try {
      const content = await fs.readFile(configUri.fsPath);
      userConfig = JSON.parse(content);
    } catch (error) {
      logger.error(
        `Failed to read initial config: ${(error as Error).message}`
      );
    }
  }
  const initialConfig = resolveConfig(BASE_CONFIG, userConfig);

  // Trigger the generation with the resolved config. This will run in the background.
  coordinator.generate(initialConfig);
}

/**
 * This method is called when the extension is deactivated.
 */
export function deactivate() {
  // Disposables are cleaned up by the subscriptions array in `activate`.
}
