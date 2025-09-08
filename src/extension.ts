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

  // 2. Determine initial state from persistent workspace storage
  const storedPauseState = context.workspaceState.get<boolean>(PAUSE_STATE_KEY);
  let startPaused: boolean;
  const isFirstRun = storedPauseState === undefined;

  if (isFirstRun) {
    // First time ever in this workspace. Start paused by default.
    startPaused = true;
  } else {
    // State exists from a previous session, so use it.
    startPaused = storedPauseState;
  }

  // 3. Register commands
  CommandRegistry.register(
    context,
    fs,
    workspaceRoot,
    coordinator,
    logger,
    ui,
    workspaceWatcher
  );

  // 4. Initialize services with the correct starting state
  CommandRegistry.setInitialPauseState(startPaused);
  workspaceWatcher.setPaused(startPaused);
  ui.setPausedState(startPaused);
  await workspaceWatcher.initialize();

  // 5. Add services to subscriptions for cleanup
  context.subscriptions.push(logger, ui, workspaceWatcher);

  // 6. Set initial UI and trigger generation if not paused
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
    // Decouple the initial, potentially slow, generation from the activation path.
    setTimeout(() => {
      runInitialGeneration(coordinator, fs, logger);
    }, 0);
  }
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
