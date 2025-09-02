// src/extension.ts
import * as vscode from 'vscode';
import * as path from 'path';
import { Logger } from './infrastructure/Logger';
import { FileSystem } from './infrastructure/FileSystem';
import { FileScanner } from './infrastructure/FileScanner';
import { UIState, VSCodeUI } from './infrastructure/VSCodeUI';
import { GenerationCoordinator } from './application/GenerationCoordinator';
import { BASE_CONFIG, RepoScribeConfig } from './domain/config/types';
import { resolveConfig } from './domain/config/resolver';

// Type alias for the dynamically imported debounce function to avoid using `any`.
type DebounceFnType = Awaited<typeof import('debounce-fn')>['default'];

let isAutoGenerationPaused = false;

/**
 * This method is called when the extension is activated.
 * It sets up all dependencies and kicks off the initial generation.
 */
export async function activate(context: vscode.ExtensionContext) {
  // Dynamically import debounce-fn as it's an ESM-only module.
  const { default: debounceFn } = await import('debounce-fn');

  // 1. Ensure a workspace is open
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage(
      'RepoScribe requires an open folder to work.'
    );
    return;
  }
  const workspaceRoot = workspaceFolders[0].uri.fsPath;

  // 2. Instantiate core services
  const logger = new Logger('RepoScribe');
  const fs = new FileSystem();
  const fileScanner = new FileScanner();

  // 3. Resolve initial configuration once to avoid redundant reads
  const initialConfig = await resolveInitialConfig(fs, logger);

  // 4. Instantiate UI and Coordinator
  const copyFileContentCommandId = 'reposcribe.copyFileContent';
  const ui = new VSCodeUI(copyFileContentCommandId);

  const coordinator = new GenerationCoordinator(
    logger,
    fs,
    fileScanner,
    ui,
    workspaceRoot
  );

  // 5. Register all commands
  registerCommands(context, fs, workspaceRoot, coordinator, logger, ui);

  // 6. Add all disposable services to the extension's subscriptions
  context.subscriptions.push(logger, ui);

  // 7. Set up file watchers for automatic updates
  setupWatchers(context, coordinator, initialConfig, logger, debounceFn);

  // 8. Provide immediate feedback that the extension is ready
  ui.updateStatus(UIState.IDLE);

  // 9. Trigger the initial generation as a non-blocking background task
  coordinator.generate(initialConfig);
}

function registerCommands(
  context: vscode.ExtensionContext,
  fs: FileSystem,
  workspaceRoot: string,
  coordinator: GenerationCoordinator,
  logger: Logger,
  ui: VSCodeUI
) {
  const openOutputFileCommandId = 'reposcribe.openOutputFile';
  context.subscriptions.push(
    vscode.commands.registerCommand(openOutputFileCommandId, async () => {
      const outputFile = await getLatestOutputFile(fs);
      const fileUri = vscode.Uri.file(path.join(workspaceRoot, outputFile));
      try {
        await vscode.workspace.fs.stat(fileUri);
        await vscode.window.showTextDocument(fileUri);
      } catch {
        vscode.window.showErrorMessage(
          `RepoScribe output file not found: ${outputFile}`
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('reposcribe.copyFileContent', async () => {
      const outputFile = await getLatestOutputFile(fs);
      const fileUri = vscode.Uri.file(path.join(workspaceRoot, outputFile));
      try {
        const contentBytes = await vscode.workspace.fs.readFile(fileUri);
        const content = Buffer.from(contentBytes).toString('utf8');
        await vscode.env.clipboard.writeText(content);
        vscode.window.showInformationMessage(
          'RepoScribe: Copied file content to clipboard.'
        );
      } catch {
        vscode.window.showErrorMessage(
          `RepoScribe output file not found: ${outputFile}`
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('reposcribe.forceRebuild', () => {
      logger.info('Force rebuild command triggered.');
      coordinator.generate();
    }),
    vscode.commands.registerCommand('reposcribe.createConfigFile', async () => {
      await createConfigFile(fs, workspaceRoot, logger);
    }),
    vscode.commands.registerCommand('reposcribe.toggleAutoGeneration', () => {
      isAutoGenerationPaused = !isAutoGenerationPaused;
      ui.setPausedState(isAutoGenerationPaused); // Inform the UI of the state change

      if (isAutoGenerationPaused) {
        ui.updateStatus(UIState.PAUSED);
        vscode.window.showInformationMessage(
          'RepoScribe auto-generation paused.'
        );
        logger.info('Auto-generation paused.');
      } else {
        ui.updateStatus(UIState.IDLE);
        vscode.window.showInformationMessage(
          'RepoScribe auto-generation resumed.'
        );
        logger.info('Auto-generation resumed. Triggering a build to sync...');
        coordinator.generate();
      }
    })
  );
}

async function createConfigFile(
  fs: FileSystem,
  wsRoot: string,
  logger: Logger
) {
  const configPath = path.join(wsRoot, '.reposcribe.json');
  const configUri = vscode.Uri.file(configPath);

  try {
    await vscode.workspace.fs.stat(configUri);
    vscode.window.showInformationMessage('.reposcribe.json already exists.');
  } catch {
    // File does not exist, so create it with default values.
    const defaultConfigForFile = {
      outputFile: BASE_CONFIG.outputFile,
      include: [], // User should define these explicitly
      exclude: BASE_CONFIG.exclude, // Populate with default exclusions
      regenerationDelay: BASE_CONFIG.regenerationDelay,
    };
    const configContent = JSON.stringify(defaultConfigForFile, null, 2);

    await vscode.workspace.fs.writeFile(
      configUri,
      Buffer.from(configContent, 'utf8')
    );
    await fs.updateGitignore(wsRoot, '.reposcribe.json');
    logger.info('Created .reposcribe.json configuration file.');
    vscode.window.showInformationMessage(
      'Created .reposcribe.json with default values.'
    );
  }
}

async function resolveInitialConfig(
  fs: FileSystem,
  logger: Logger
): Promise<RepoScribeConfig> {
  logger.info('Performing initial configuration resolution.');
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
  return resolveConfig(BASE_CONFIG, userConfig);
}

async function getLatestOutputFile(fs: FileSystem): Promise<string> {
  const configUri = await fs.findFile('.reposcribe.json');
  if (configUri) {
    try {
      const content = await fs.readFile(configUri.fsPath);
      const config = JSON.parse(content);
      return config.outputFile || BASE_CONFIG.outputFile;
    } catch {
      // Intentional fall-through to default
    }
  }
  return BASE_CONFIG.outputFile;
}

/**
 * Creates and infigures file system watchers to trigger regeneration.
 */
function setupWatchers(
  context: vscode.ExtensionContext,
  coordinator: GenerationCoordinator,
  config: RepoScribeConfig,
  logger: Logger,
  debounceFn: DebounceFnType
) {
  const debouncedGenerate = debounceFn(() => coordinator.generate(), {
    wait: config.regenerationDelay,
  });

  const configWatcher = vscode.workspace.createFileSystemWatcher(
    '**/{.reposcribe.json,.gitignore}'
  );
  const triggerImmediateRegen = (uri: vscode.Uri) => {
    if (isAutoGenerationPaused) {
      return;
    }
    logger.info(
      `Config file change detected (${path.basename(
        uri.fsPath
      )}), triggering immediate regeneration.`
    );
    coordinator.generate();
  };
  configWatcher.onDidChange(triggerImmediateRegen);
  configWatcher.onDidCreate(triggerImmediateRegen);
  configWatcher.onDidDelete(triggerImmediateRegen);

  const generalWatcher = vscode.workspace.createFileSystemWatcher(
    '**/*',
    false,
    false,
    false
  );

  const handleGeneralEvent = (uri: vscode.Uri) => {
    if (isAutoGenerationPaused) {
      return;
    }
    if (uri.fsPath.endsWith(config.outputFile)) {
      return;
    }
    logger.info(
      `File change detected (${path.basename(
        uri.fsPath
      )}). Debouncing regeneration.`
    );
    debouncedGenerate();
  };
  generalWatcher.onDidChange(handleGeneralEvent);
  generalWatcher.onDidCreate(handleGeneralEvent);
  generalWatcher.onDidDelete(handleGeneralEvent);

  context.subscriptions.push(configWatcher, generalWatcher);
}

/**
 * This method is called when the extension is deactivated.
 * Disposables are cleaned up by the subscriptions array.
 */
export function deactivate() {
  // This function is intentionally empty.
}
