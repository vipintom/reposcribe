// src/application/CommandRegistry.ts
import * as vscode from 'vscode';
import * as path from 'path';
import { GenerationCoordinator } from './GenerationCoordinator';
import { WorkspaceWatcher } from './WorkspaceWatcher';
import { FileSystem } from '../infrastructure/FileSystem';
import { Logger } from '../infrastructure/Logger';
import { VSCodeUI, UIState } from '../infrastructure/VSCodeUI';
import { BASE_CONFIG } from '../domain/config/types';
import { ConfigurationService } from './ConfigurationService';

// Type alias for the dynamically imported module
type JsoncParseType = typeof import('jsonc-parser').parse;

const PAUSE_STATE_KEY = 'reposcribe.isPaused';

/**
 * Encapsulates all command registration logic for the extension.
 */
export class CommandRegistry {
  private static isAutoGenerationPaused = false;
  private static jsoncParse: JsoncParseType | null = null;

  private static async getJsoncParse(): Promise<JsoncParseType> {
    if (!this.jsoncParse) {
      this.jsoncParse = (await import('jsonc-parser')).parse;
    }
    return this.jsoncParse;
  }

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
   * @param configService The ConfigurationService.
   */
  public static register(
    context: vscode.ExtensionContext,
    fs: FileSystem,
    workspaceRoot: string,
    coordinator: GenerationCoordinator,
    logger: Logger,
    ui: VSCodeUI,
    watcher: WorkspaceWatcher,
    configService: ConfigurationService
  ): void {
    context.subscriptions.push(
      vscode.commands.registerCommand('reposcribe.openOutputFile', async () =>
        this.openOutputFile(workspaceRoot, configService)
      ),
      vscode.commands.registerCommand('reposcribe.copyFileContent', async () =>
        this.copyFileContent(workspaceRoot, configService)
      ),
      vscode.commands.registerCommand('reposcribe.forceRebuild', () => {
        logger.info('Force rebuild command triggered.');
        // Clear cache before a manual rebuild to pick up any un-watched changes
        configService.clearCache();
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
          // Clear cache on resume in case config was changed while paused.
          configService.clearCache();
          coordinator.generate();
        }
      }),
      vscode.commands.registerCommand(
        'reposcribe.generateForSelection',
        async (uri: vscode.Uri, selectedUris?: vscode.Uri[]) => {
          const urisToProcess =
            selectedUris && selectedUris.length > 0 ? selectedUris : [uri];

          if (!urisToProcess.every((u) => u && u.fsPath)) {
            logger.error(
              'Generate for selection command called with invalid URIs.'
            );
            vscode.window.showErrorMessage(
              'Could not determine the target files/folders.'
            );
            return;
          }
          const selectedPaths = urisToProcess.map((u) => u.fsPath);

          let idleTimer: NodeJS.Timeout | undefined;
          try {
            ui.updateStatus(UIState.GENERATING);
            const markdown = await coordinator.generateMarkdownForSelection(
              selectedPaths
            );
            await vscode.env.clipboard.writeText(markdown);
            vscode.window.showInformationMessage(
              'RepoScribe: Snapshot for selection copied to clipboard.'
            );
            ui.updateStatus(UIState.UPDATED, 'Copied');

            idleTimer = setTimeout(() => {
              ui.updateStatus(
                this.isAutoGenerationPaused ? UIState.PAUSED : UIState.IDLE
              );
            }, 3000);
          } catch (error) {
            if (idleTimer) {
              clearTimeout(idleTimer);
            }
            const err = error as Error;
            const errorMessage = `Failed to generate snapshot for selection: ${err.message}`;
            logger.error(`${errorMessage}\n${err.stack}`);
            ui.updateStatus(UIState.ERROR, 'Generation failed. Check logs.');
            vscode.window.showErrorMessage(errorMessage);
          }
        }
      )
    );
  }

  private static async openOutputFile(
    workspaceRoot: string,
    configService: ConfigurationService
  ): Promise<void> {
    const { resolvedConfig } = await configService.getConfigContext();
    const outputFile = resolvedConfig.outputFile;
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
    workspaceRoot: string,
    configService: ConfigurationService
  ): Promise<void> {
    const { resolvedConfig } = await configService.getConfigContext();
    const outputFile = resolvedConfig.outputFile;
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

  private static generateConfigTemplate(): string {
    const defaultExcludesList = BASE_CONFIG.exclude
      .map((item) => `// - "${item}"`)
      .join('\n');

    const topComment = `// RepoScribe Configuration File (.jsonc format supports comments)
//
// This file allows you to customize RepoScribe's behavior. For a full explanation
// of the filtering logic, please see the extension's documentation.
//
// Default Exclusions Reference:
// RepoScribe automatically ignores the following patterns. You can force a file
// to be included, even if it matches a pattern below, by adding it to the
// "include" array.
${defaultExcludesList}
`;

    return `${topComment}
{
  // (Optional) The path to the output Markdown file.
  "outputFile": "${BASE_CONFIG.outputFile}",

  // (Optional) An array of glob patterns that act as an "allow-list".
  // If a file is excluded by the default rules (listed above) or .gitignore,
  // but it matches a pattern here, it will be ADDED BACK to the snapshot.
  // This is a powerful way to override default exclusions.
  // Example: ["pnpm-lock.yaml", "dist/important-file.js"]
  "include": [],

  // (Optional) An array of glob patterns to exclude. These are applied as the
  // final filter. Any file matching a pattern here will be REMOVED, even if
  // it was included by the "include" patterns. This is the final authority.
  // Example: ["**/*.test.ts"]
  "exclude": [],

  // (Optional) The delay in milliseconds after a file change before regenerating.
  "regenerationDelay": ${BASE_CONFIG.regenerationDelay},

  // (Optional) The maximum size of a file in kilobytes to be included.
  // Set to 0 for no limit.
  "maxFileSizeKb": ${BASE_CONFIG.maxFileSizeKb}
}
`;
  }

  private static async createConfigFile(
    fs: FileSystem,
    wsRoot: string,
    logger: Logger
  ): Promise<void> {
    const configPath = path.join(wsRoot, '.reposcribe.jsonc');
    const configUri = vscode.Uri.file(configPath);

    try {
      await vscode.workspace.fs.stat(configUri);
      vscode.window.showInformationMessage('.reposcribe.jsonc already exists.');
    } catch {
      const configContent = this.generateConfigTemplate();
      await vscode.workspace.fs.writeFile(
        configUri,
        Buffer.from(configContent, 'utf8')
      );
      await fs.updateGitignore(wsRoot, '.reposcribe.jsonc');
      logger.info('Created .reposcribe.jsonc configuration file.');
      vscode.window.showInformationMessage(
        'Created .reposcribe.jsonc with default values and comments.'
      );
    }
  }

  private static async getLatestOutputFile(fs: FileSystem): Promise<string> {
    const configUri = await fs.findFile('.reposcribe.jsonc');
    if (configUri) {
      try {
        const jsoncParse = await this.getJsoncParse();
        const content = await fs.readFile(configUri.fsPath);
        const config = jsoncParse(content);
        return config.outputFile || BASE_CONFIG.outputFile;
      } catch {
        // Fall-through to default
      }
    }
    return BASE_CONFIG.outputFile;
  }
}
