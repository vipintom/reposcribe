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

  /**
   * Creates an instance of VSCodeUI.
   * @param commandOnClick The command ID to execute when the status bar item is clicked.
   */
  constructor(commandOnClick: string) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.command = commandOnClick;
    this.statusBarItem.show();
  }

  /**
   * Updates the status bar item's icon, text, and tooltip based on the extension's state.
   * @param state The current state of the UI.
   * @param details Optional additional information for the tooltip.
   */
  public updateStatus(state: UIState, details?: string): void {
    switch (state) {
      case UIState.IDLE:
        this.statusBarItem.text = `$(file-code) RepoScribe: Ready`;
        this.statusBarItem.tooltip =
          'RepoScribe is watching for changes. Click for options.';
        break;

      case UIState.GENERATING:
        this.statusBarItem.text = `$(sync~spin) RepoScribe: Generating...`;
        this.statusBarItem.tooltip =
          'RepoScribe is generating the project snapshot.';
        break;

      case UIState.UPDATED:
        this.statusBarItem.text = `$(check) RepoScribe: Updated`;
        this.statusBarItem.tooltip = `Project snapshot updated. ${
          details ? `(${details})` : ''
        }\nClick for options.`;
        break;

      case UIState.ERROR:
        this.statusBarItem.text = `$(error) RepoScribe: Error`;
        this.statusBarItem.tooltip = `An error occurred. ${
          details || 'Check the RepoScribe output channel for details.'
        }\nClick for options.`;
        break;

      case UIState.PAUSED:
        this.statusBarItem.text = `$(debug-pause) RepoScribe: Paused`;
        this.statusBarItem.tooltip =
          'Auto-generation is paused. Click for options.';
        break;
    }
  }

  /**
   * Disposes of the status bar item, removing it from the UI.
   */
  public dispose(): void {
    this.statusBarItem.dispose();
  }
}
