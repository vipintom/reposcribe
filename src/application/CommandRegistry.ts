// src/application/CommandRegistry.ts
import * as vscode from 'vscode';
import * as path from 'path';
import { GenerationCoordinator } from './GenerationCoordinator';
import { WorkspaceWatcher } from './WorkspaceWatcher';
import { FileSystem } from '../infrastructure/FileSystem';
import { Logger } from '../infrastructure/Logger';
import { VSCodeUI, UIState } from '../infrastructure/VSCodeUI';
import { BASE_CONFIG } from '../domain/config/types';

const PAUSE_STATE_KEY = 'reposcribe.isPaused';

/**
 * Encapsulates all command registration logic for the extension.
 */
export class CommandRegistry {
  private static isAutoGenerationPaused = false;

  /**
   * Sets the initial paused state of the command registry.
   * @param paused Whether the extension should start paused.
   */
  public static setInitialPauseState(paused: boolean): void {
    this.isAutoGenerationPaused = paused;
  }

  /**
   * Registers all commands for the RepoScribe extension.
   * @param context The extension context for managing subscriptions and state.
   * @param fs The FileSystem service.
   * @param workspaceRoot The root path of the current workspace.
   * @param coordinator The GenerationCoordinator service.
   * @param logger The Logger service.
   * @param ui The VSCodeUI service.
   * @param watcher The WorkspaceWatcher service.
   */
  public static register(
    context: vscode.ExtensionContext,
    fs: FileSystem,
    workspaceRoot: string,
    coordinator: GenerationCoordinator,
    logger: Logger,
    ui: VSCodeUI,
    watcher: WorkspaceWatcher
  ): void {
    context.subscriptions.push(
      vscode.commands.registerCommand('reposcribe.openOutputFile', async () =>
        this.openOutputFile(fs, workspaceRoot)
      ),
      vscode.commands.registerCommand('reposcribe.copyFileContent', async () =>
        this.copyFileContent(fs, workspaceRoot)
      ),
      vscode.commands.registerCommand('reposcribe.forceRebuild', () => {
        logger.info('Force rebuild command triggered.');
        coordinator.generate();
      }),
      vscode.commands.registerCommand('reposcribe.createConfigFile', async () =>
        this.createConfigFile(fs, workspaceRoot, logger)
      ),
      vscode.commands.registerCommand('reposcribe.toggleAutoGeneration', () => {
        // Toggle the state
        this.isAutoGenerationPaused = !this.isAutoGenerationPaused;

        // Persist the new state for the workspace
        context.workspaceState.update(
          PAUSE_STATE_KEY,
          this.isAutoGenerationPaused
        );

        // Update application components
        ui.setPausedState(this.isAutoGenerationPaused);
        watcher.setPaused(this.isAutoGenerationPaused);

        if (this.isAutoGenerationPaused) {
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

  private static async openOutputFile(
    fs: FileSystem,
    workspaceRoot: string
  ): Promise<void> {
    const outputFile = await this.getLatestOutputFile(fs);
    const fileUri = vscode.Uri.file(path.join(workspaceRoot, outputFile));
    try {
      await vscode.workspace.fs.stat(fileUri);
      await vscode.window.showTextDocument(fileUri);
    } catch {
      vscode.window.showErrorMessage(
        `RepoScribe output file not found: ${outputFile}`
      );
    }
  }

  private static async copyFileContent(
    fs: FileSystem,
    workspaceRoot: string
  ): Promise<void> {
    const outputFile = await this.getLatestOutputFile(fs);
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
  }

  private static async createConfigFile(
    fs: FileSystem,
    wsRoot: string,
    logger: Logger
  ): Promise<void> {
    const configPath = path.join(wsRoot, '.reposcribe.json');
    const configUri = vscode.Uri.file(configPath);

    try {
      await vscode.workspace.fs.stat(configUri);
      vscode.window.showInformationMessage('.reposcribe.json already exists.');
    } catch {
      const defaultConfigForFile = {
        outputFile: BASE_CONFIG.outputFile,
        include: [],
        exclude: BASE_CONFIG.exclude,
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

  private static async getLatestOutputFile(fs: FileSystem): Promise<string> {
    const configUri = await fs.findFile('.reposcribe.json');
    if (configUri) {
      try {
        const content = await fs.readFile(configUri.fsPath);
        const config = JSON.parse(content);
        return config.outputFile || BASE_CONFIG.outputFile;
      } catch {
        // Fall-through to default
      }
    }
    return BASE_CONFIG.outputFile;
  }
}
