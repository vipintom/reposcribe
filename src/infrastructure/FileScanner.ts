// src/infrastructure/FileScanner.ts
import * as path from 'path';
import type { RepoScribeConfig } from '../domain/config/types';
import type fg from 'fast-glob'; // Use a type-only import to get the correct type
import { Logger } from './Logger';

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

  constructor(private readonly logger: Logger) {}

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
    userConfig: Partial<RepoScribeConfig>,
    baseConfig: RepoScribeConfig,
    gitignoreContent: string
  ): Promise<string[]> {
    const fg = await this.getFg();
    const ignore = await this.getIgnoreFactory();
    this.logger.info('--- Starting File Scan ---');

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
    this.logger.info(
      `[SCANNER] Stage 1: Found ${allRelativeFiles.length} total files.`
    );

    // Stage 2: Apply `.gitignore`
    const gitignoreFilter = ignore().add(gitignoreContent);
    const filesAfterGitignore = gitignoreFilter.filter(allRelativeFiles);
    this.logger.info(
      `[SCANNER] Stage 2: ${filesAfterGitignore.length} files remain after .gitignore filter.`
    );

    // Stage 3: Apply default `exclude` rules
    const baseExcludeFilter = ignore().add(baseConfig.exclude);
    const filesAfterBaseExclude = baseExcludeFilter.filter(filesAfterGitignore);
    this.logger.info(
      `[SCANNER] Stage 3: ${filesAfterBaseExclude.length} files remain after default exclude filter.`
    );

    // Stage 4: Add back files based on user's `include` patterns
    let listBeforeUserExclude = filesAfterBaseExclude;
    if (config.include && config.include.length > 0) {
      this.logger.info(
        `[SCANNER] Stage 4: Processing ${
          config.include.length
        } user 'include' patterns: [${config.include.join(', ')}]`
      );
      // Find which files were excluded by the base config
      const filesAfterBaseExcludeSet = new Set(filesAfterBaseExclude);
      const filesExcludedByBase = filesAfterGitignore.filter(
        (file) => !filesAfterBaseExcludeSet.has(file)
      );
      this.logger.info(
        `[SCANNER]          - Checking ${filesExcludedByBase.length} files that were excluded by default rules.`
      );

      // Create a filter that keeps only files matching the `include` patterns.
      const includeFilter = ignore()
        .add('**/*')
        .add(config.include.map((p) => `!${p}`));

      const filesToUnexclude = includeFilter.filter(filesExcludedByBase);
      this.logger.info(
        `[SCANNER]          - Re-included ${filesToUnexclude.length} files matching 'include' patterns.`
      );

      // Add the re-included files back to the list
      listBeforeUserExclude = [...filesAfterBaseExclude, ...filesToUnexclude];
      this.logger.info(
        `[SCANNER]          - File count is now ${listBeforeUserExclude.length}.`
      );
    } else {
      this.logger.info(
        '[SCANNER] Stage 4: No user "include" patterns to process.'
      );
    }

    // Stage 5: Apply user-specific `exclude` rules as the final filter.
    const userExcludes = userConfig.exclude || [];

    let finalRelativeFiles = listBeforeUserExclude;
    if (userExcludes.length > 0) {
      this.logger.info(
        `[SCANNER] Stage 5: Applying ${
          userExcludes.length
        } user-specific 'exclude' patterns: [${userExcludes.join(', ')}]`
      );
      const userExcludeFilter = ignore().add(userExcludes);
      finalRelativeFiles = userExcludeFilter.filter(listBeforeUserExclude);
      this.logger.info(
        `[SCANNER]          - Final file count after user excludes: ${finalRelativeFiles.length}.`
      );
    } else {
      this.logger.info(
        '[SCANNER] Stage 5: No user-specific "exclude" patterns to apply.'
      );
    }

    const finalAbsoluteFiles = finalRelativeFiles.map((file) =>
      path.join(workspaceRoot, file)
    );

    this.logger.info(
      `--- File Scan Finished: ${finalAbsoluteFiles.length} files selected ---`
    );
    return finalAbsoluteFiles;
  }
}
