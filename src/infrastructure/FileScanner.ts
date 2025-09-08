// src/infrastructure/FileScanner.ts
import * as path from 'path';
import type { RepoScribeConfig } from '../domain/config/types';
import type fg from 'fast-glob'; // Use a type-only import to get the correct type

// Dynamically imported module types for caching
type FgType = typeof fg;
type IgnoreFactory = typeof import('ignore');

/**
 * Scans the workspace for files based on a set of filtering rules derived from
 * .gitignore and the RepoScribe configuration.
 */
export class FileScanner {
  private fg: FgType | null = null;
  private ignore: IgnoreFactory | null = null;

  private async getFg(): Promise<FgType> {
    if (!this.fg) {
      // The module has a default export which is the function we need
      this.fg = (await import('fast-glob')).default;
    }
    return this.fg;
  }

  private async getIgnoreFactory(): Promise<IgnoreFactory> {
    if (!this.ignore) {
      // The 'ignore' package's main export is the entire module
      this.ignore = (await import('ignore')).default;
    }
    return this.ignore;
  }

  /**
   * Scans the workspace, applies all filtering rules in the correct order of precedence,
   * and returns a final, sorted list of absolute file paths to be included in the output.
   */
  public async scan(
    workspaceRoot: string,
    config: RepoScribeConfig,
    gitignoreContent: string
  ): Promise<string[]> {
    const fg = await this.getFg();
    const ignore = await this.getIgnoreFactory();

    // 1. Discover All: Start with a list of all files in the workspace.
    const allFiles = await fg('**/*', {
      cwd: workspaceRoot,
      dot: true, // Include dotfiles
      absolute: true, // Get absolute paths
      followSymbolicLinks: false,
      onlyFiles: true,
      suppressErrors: true, // Prevent EACCES errors from crashing the scan
    });

    // For filtering, we need paths relative to the workspace root.
    const relativeFiles = allFiles.map((file: string) =>
      path.relative(workspaceRoot, file)
    );

    // 2. Apply `.gitignore`
    const gitignoreFilter = ignore().add(gitignoreContent);
    const afterGitignore = gitignoreFilter.filter(relativeFiles);

    // 3. Apply Custom `include`
    let afterInclude = afterGitignore;
    if (config.include && config.include.length > 0) {
      const includePatterns = ['**/*', ...config.include.map((p) => `!${p}`)];
      const includeFilter = ignore().add(includePatterns);
      afterInclude = includeFilter.filter(afterGitignore);
    }

    // 4. Apply `exclude`
    const excludeFilter = ignore().add(config.exclude);
    const finalRelativeFiles = excludeFilter.filter(afterInclude);

    // Convert back to absolute paths for the final list.
    const finalAbsoluteFiles = finalRelativeFiles.map((file: string) =>
      path.join(workspaceRoot, file)
    );

    return finalAbsoluteFiles;
  }
}
