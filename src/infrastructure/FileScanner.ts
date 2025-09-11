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
      this.fg = (await import('fast-glob')).default;
    }
    return this.fg;
  }

  private async getIgnoreFactory(): Promise<IgnoreFactory> {
    if (!this.ignore) {
      this.ignore = (await import('ignore')).default;
    }
    return this.ignore;
  }

  /**
   * Scans the workspace, applies all filtering rules in the correct order of precedence,
   * and returns a final, sorted list of absolute file paths to be included in the output.
   *
   * The filtering precedence is as follows:
   * 1. All files are discovered.
   * 2. Files matching `.gitignore` are removed.
   * 3. Files matching the default `exclude` patterns are removed.
   * 4. Files that were removed by the default `exclude` patterns are ADDED BACK if they match a user `include` pattern.
   * 5. Finally, files matching a user `exclude` pattern are removed. This gives user `exclude` final authority.
   */
  public async scan(
    workspaceRoot: string,
    config: RepoScribeConfig,
    baseConfig: RepoScribeConfig, // Still needed to differentiate base/user excludes for include logic
    gitignoreContent: string
  ): Promise<string[]> {
    const fg = await this.getFg();
    const ignore = await this.getIgnoreFactory();

    // Stage 1: Discover All files
    const allAbsoluteFiles = await fg('**/*', {
      cwd: workspaceRoot,
      dot: true,
      absolute: true,
      followSymbolicLinks: false,
      onlyFiles: true,
      suppressErrors: true,
    });
    const allRelativeFiles = allAbsoluteFiles.map((file) =>
      path.relative(workspaceRoot, file)
    );

    // Stage 2: Apply `.gitignore`
    const gitignoreFilter = ignore().add(gitignoreContent);
    const filesAfterGitignore = gitignoreFilter.filter(allRelativeFiles);

    // Stage 3: Apply default `exclude` rules ONLY
    const baseExcludeFilter = ignore().add(baseConfig.exclude);
    const filesAfterBaseExclude = baseExcludeFilter.filter(filesAfterGitignore);

    // Stage 4: Add back files based on user's `include` patterns
    let filesAfterInclude = filesAfterBaseExclude;
    if (config.include && config.include.length > 0) {
      // Find which files were excluded by the base config
      const filesAfterBaseExcludeSet = new Set(filesAfterBaseExclude);
      const filesExcludedByBase = filesAfterGitignore.filter(
        (file) => !filesAfterBaseExcludeSet.has(file)
      );

      // Create a filter that keeps only files matching the `include` patterns
      const includePatterns = ['**/*', ...config.include.map((p) => `!${p}`)];
      const includeFilter = ignore().add(includePatterns);
      const filesToUnexclude = includeFilter.filter(filesExcludedByBase);

      // Add the re-included files back to the list
      filesAfterInclude = [...filesAfterBaseExclude, ...filesToUnexclude];
    }

    // Stage 5: Apply the FULL `exclude` list (base + user) as the final filter
    const finalExcludeFilter = ignore().add(config.exclude);
    const finalRelativeFiles = finalExcludeFilter.filter(filesAfterInclude);

    const finalAbsoluteFiles = finalRelativeFiles.map((file) =>
      path.join(workspaceRoot, file)
    );

    return finalAbsoluteFiles;
  }
}
