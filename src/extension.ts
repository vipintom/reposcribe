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

const PAUSE_STATE_KEY = 'reposcribe.isPaused';

/**
 * This method is called when the extension is activated.
 * Its sole purpose is to instantiate and wire up all application services.
 * This function must complete as quickly as possible.
 */
export function activate(context: vscode.ExtensionContext) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage(
      'RepoScribe requires an open folder to work.'
    );
    return;
  }
  const workspaceRoot = workspaceFolders[0].uri.fsPath;

  // 1. Instantiate all services (all synchronous and fast)
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

  // Note: debounceFn is dynamically imported in startup() where it's needed.
  const workspaceWatcher = new WorkspaceWatcher(
    coordinator,
    fs,
    logger,
    workspaceRoot
  );

  // 2. Register all commands (synchronous)
  CommandRegistry.register(
    context,
    fs,
    workspaceRoot,
    coordinator,
    logger,
    ui,
    workspaceWatcher
  );

  // 3. Add services to subscriptions for cleanup (synchronous)
  context.subscriptions.push(logger, ui, workspaceWatcher);

  // 4. Schedule the asynchronous startup logic to run after activation completes.
  // This is the key to a fast startup.
  setTimeout(
    () => startup(context, logger, ui, workspaceWatcher, coordinator, fs),
    0
  );
}

/**
 * Performs all asynchronous startup tasks, such as reading state, initializing
 * watchers, and triggering the first generation run.
 */
async function startup(
  context: vscode.ExtensionContext,
  logger: Logger,
  ui: VSCodeUI,
  watcher: WorkspaceWatcher,
  coordinator: GenerationCoordinator,
  fs: FileSystem
) {
  // Dynamically import debounce-fn here
  const { default: debounceFn } = await import('debounce-fn');
  watcher.setDebounceFn(debounceFn);

  // Determine initial state from persistent workspace storage
  const storedPauseState = context.workspaceState.get<boolean>(PAUSE_STATE_KEY);
  let startPaused: boolean;
  const isFirstRun = storedPauseState === undefined;

  if (isFirstRun) {
    startPaused = true; // Default to paused for new projects
  } else {
    startPaused = storedPauseState; // Restore previous state
  }

  // Initialize services with the correct starting state
  CommandRegistry.setInitialPauseState(startPaused);
  watcher.setPaused(startPaused);
  ui.setPausedState(startPaused);

  // Now perform the async watcher initialization
  await watcher.initialize();

  // Set initial UI and trigger generation if not paused
  if (startPaused) {
    ui.updateStatus(UIState.PAUSED);
    if (isFirstRun) {
      vscode.window.showInformationMessage(
        'RepoScribe is paused for this new project. Click the status bar icon to resume and generate the initial snapshot.'
      );
      logger.info('New project detected. RepoScribe is paused by default.');
    } else {
      logger.info('RepoScribe started in a paused state as per last session.');
    }
  } else {
    ui.updateStatus(UIState.IDLE);
    runInitialGeneration(coordinator, fs, logger);
  }
}

/**
 * Performs the initial, potentially slow, setup and generation task.
 */
async function runInitialGeneration(
  coordinator: GenerationCoordinator,
  fs: FileSystem,
  logger: Logger
): Promise<void> {
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

  coordinator.generate(initialConfig);
}

/**
 * This method is called when the extension is deactivated.
 */
export function deactivate() {
  // Disposables are cleaned up by the subscriptions array in `activate`.
}
