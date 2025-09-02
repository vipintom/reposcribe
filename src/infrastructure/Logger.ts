// src/infrastructure/Logger.ts
import * as vscode from 'vscode';

/**
 * A centralized logger that writes to a dedicated VS Code output channel.
 * Implements vscode.Disposable to integrate with VS Code's subscription management.
 */
export class Logger implements vscode.Disposable {
  private readonly outputChannel: vscode.OutputChannel;

  /**
   * Creates an instance of the Logger.
   * @param channelName The name that will appear in the Output channel dropdown.
   */
  constructor(channelName: string) {
    this.outputChannel = vscode.window.createOutputChannel(channelName);
  }

  /**
   * Logs an informational message.
   * @param message The message to log.
   */
  public info(message: string): void {
    this.log('INFO', message);
  }

  /**
   * Logs a warning message.
   * @param message The message to log.
   */
  public warn(message: string): void {
    this.log('WARN', message);
  }

  /**
   * Logs an error message. If an Error object is provided, its stack trace is included.
   * @param message The string or Error object to log.
   */
  public error(message: string | Error): void {
    if (message instanceof Error) {
      this.log(
        'ERROR',
        `${message.message}${message.stack ? `\n${message.stack}` : ''}`
      );
    } else {
      this.log('ERROR', message);
    }
  }

  /**
   * Disposes of the logger and its underlying output channel.
   * This is called by VS Code when the extension is deactivated.
   */
  public dispose(): void {
    this.outputChannel.dispose();
  }

  /**
   * The core logging method that formats and writes messages to the output channel.
   * @param level The log level (e.g., 'INFO', 'ERROR').
   * @param message The message to write.
   */
  private log(level: string, message: string): void {
    const timestamp = new Date().toISOString();
    this.outputChannel.appendLine(
      `[${timestamp}] [${level.toUpperCase()}] ${message}`
    );
  }
}
