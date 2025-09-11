// src/extension.ts
import * as vscode from 'vscode';
import { Logger } from './infrastructure/Logger';
import { FileSystem } from './infrastructure/FileSystem';
import { FileScanner } from './infrastructure/FileScanner';
import { UIState, VSCodeUI } from './infrastructure/VSCodeUI';
import { GenerationCoordinator } from './application/GenerationCoordinator';
import { WorkspaceWatcher } from './application/WorkspaceWatcher';
import { CommandRegistry } from './application/CommandRegistry';
import { ConfigurationService } from './application/ConfigurationService';

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
  const configService = new ConfigurationService(fs, logger);
  const fileScanner = new FileScanner(logger);
  const ui = new VSCodeUI('reposcribe.copyFileContent'); // Default click action

  const coordinator = new GenerationCoordinator(
    logger,
    fs,
    fileScanner,
    ui,
    workspaceRoot,
    configService
  );

  const workspaceWatcher = new WorkspaceWatcher(
    coordinator,
    fs,
    logger,
    workspaceRoot,
    configService
  );

  // 2. Register all commands (synchronous)
  CommandRegistry.register(
    context,
    fs,
    workspaceRoot,
    coordinator,
    logger,
    ui,
    workspaceWatcher,
    configService
  );

  // 3. Add services to subscriptions for cleanup (synchronous)
  context.subscriptions.push(logger, ui, workspaceWatcher);

  // 4. Schedule the asynchronous startup logic to run after activation completes.
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
  // Check for deprecated config files
  const oldJsonConfig = await fs.findConfig('.reposcribe.json');
  const oldJsoncConfig = await fs.findConfig('.reposcribe.jsonc');
  const deprecatedConfig = oldJsonConfig || oldJsoncConfig;

  if (deprecatedConfig) {
    const fileName = deprecatedConfig.fsPath.split('/').pop();
    logger.warn(
      `Deprecated '${fileName}' file found and ignored at: ${deprecatedConfig.fsPath}`
    );

    const createNewFileAction = 'Create .reposcribe.config.js';
    const deleteOldFileAction = `Delete ${fileName}`;
    vscode.window
      .showWarningMessage(
        `The '${fileName}' file is deprecated and is being ignored. Please migrate to '.reposcribe.config.js'.`,
        createNewFileAction,
        deleteOldFileAction
      )
      .then(async (selection) => {
        if (selection === createNewFileAction) {
          vscode.commands.executeCommand('reposcribe.createConfigFile');
        } else if (selection === deleteOldFileAction) {
          try {
            await vscode.workspace.fs.delete(deprecatedConfig);
            vscode.window.showInformationMessage(
              `Successfully deleted the deprecated ${fileName} file.`
            );
            logger.info(
              `User deleted deprecated file: ${deprecatedConfig.fsPath}`
            );
          } catch (error) {
            const err = error as Error;
            logger.error(`Failed to delete old config file: ${err.message}`);
            vscode.window.showErrorMessage(
              `Failed to delete ${fileName}: ${err.message}`
            );
          }
        }
      });
  }

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
    coordinator.generate();
  }
}

/**
 * This method is called when the extension is deactivated.
 */
export function deactivate() {
  // Disposables are cleaned up by the subscriptions array in `activate`.
}
