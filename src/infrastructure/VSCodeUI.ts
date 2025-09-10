// src/infrastructure/VSCodeUI.ts
import * as vscode from 'vscode';

/**
 * Defines the possible states for the UI's status bar.
 */
export enum UIState {
  IDLE,
  GENERATING,
  UPDATED,
  ERROR,
  PAUSED,
}

/**
 * Manages all VS Code UI elements, primarily the status bar item.
 * Implements vscode.Disposable for clean integration with the extension context.
 */
export class VSCodeUI implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;
  private isPaused = false;

  /**
   * Creates an instance of VSCodeUI.
   * @param commandOnClick The command ID to execute when the status bar item is clicked.
   */
  constructor(commandOnClick: string) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right, // Positioned on the right
      10 // Priority to appear before other common icons
    );
    this.statusBarItem.command = commandOnClick;
    this.statusBarItem.show();
  }

  /**
   * Sets the paused state of the UI, which affects the tooltip content.
   * @param isPaused Whether the auto-generation is paused.
   */
  public setPausedState(isPaused: boolean): void {
    this.isPaused = isPaused;
  }

  /**
   * Generates the rich hover tooltip with clickable command links.
   * @param state The current UI state.
   * @param details Optional details, like an update timestamp.
   * @returns A MarkdownString to be used as the tooltip.
   */
  private createTooltip(
    state: UIState,
    details?: string
  ): vscode.MarkdownString {
    const md = new vscode.MarkdownString('', true);
    md.isTrusted = true; // IMPORTANT: Allows commands to be executed from the tooltip

    let statusText: string;
    switch (state) {
      case UIState.IDLE:
        statusText = 'Ready and watching';
        break;
      case UIState.GENERATING:
        statusText = 'Generating the project snapshot...';
        break;
      case UIState.UPDATED:
        statusText = `Updated ${details ? `at ${details}` : ''}.`;
        break;
      case UIState.ERROR:
        statusText = 'An error occurred.';
        break;
      case UIState.PAUSED:
        statusText = 'Automatic generation is paused.';
        break;
    }
    md.appendMarkdown(`**RepoScribe**\n\n${statusText}\n\n---\n`);

    const pauseToggle = this.isPaused
      ? `[$(play) Resume Watcher](command:reposcribe.toggleAutoGeneration "Resume automatic file generation")`
      : `[$(debug-pause) Pause Watcher](command:reposcribe.toggleAutoGeneration "Pause automatic file generation")`;

    // Use forced line breaks (two spaces at the end of the line) for a compact layout
    md.appendMarkdown(`${pauseToggle}  \n`);
    md.appendMarkdown(
      `[$(go-to-file) Open Output File](command:reposcribe.openOutputFile "Open the generated Markdown file")  \n`
    );
    md.appendMarkdown(
      `[$(clippy) Copy File Content](command:reposcribe.copyFileContent "Copy the entire content of the output file to the clipboard")`
    );

    return md;
  }

  /**
   * Updates the status bar item's icon, color, and tooltip based on the extension's state.
   * @param state The current state of the UI.
   * @param details Optional additional information for the tooltip (e.g., timestamp).
   */
  public updateStatus(state: UIState, details?: string): void {
    // Clear background color by default
    this.statusBarItem.backgroundColor = undefined;

    const baseIcon = '$(note)';
    let stateIcon = '';

    switch (state) {
      case UIState.IDLE:
        stateIcon = '$(eye-watch)';
        break;
      case UIState.GENERATING:
        stateIcon = '$(sync~spin)';
        break;
      case UIState.UPDATED:
        stateIcon = '$(check-all)';
        break;
      case UIState.ERROR:
        stateIcon = '$(error)';
        break;
      case UIState.PAUSED:
        stateIcon = '$(debug-pause)';
        break;
    }

    this.statusBarItem.text = `${baseIcon} | ${stateIcon}`;

    if (state === UIState.ERROR) {
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.errorBackground'
      );
    }

    this.statusBarItem.tooltip = this.createTooltip(state, details);
  }

  /**
   * Disposes of the status bar item, removing it from the UI.
   */
  public dispose(): void {
    this.statusBarItem.dispose();
  }
}
