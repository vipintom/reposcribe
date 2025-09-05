// src/infrastructure/FileScanner.ts
import * as path from 'path';
import * as glob from 'fast-glob';
import ignore from 'ignore';
import type { RepoScribeConfig } from '../domain/config/types';

/**
 * Scans the workspace for files based on a set of filtering rules derived from
 * .gitignore and the RepoScribe configuration.
 */
export class FileScanner {
  /**
   * Scans the workspace, applies all filtering rules in the correct order of precedence,
   * and returns a final, sorted list of absolute file paths to be included in the output.
   *
   * The filtering precedence is:
   * 1. Discover all files.
   * 2. Apply `.gitignore` rules.
   * 3. Apply `include` patterns from config (if any).
   * 4. Apply `exclude` patterns from config.
   *
   * @param workspaceRoot The absolute path to the workspace root directory.
   * @param config The resolved RepoScribe configuration.
   * @param gitignoreContent The content of the .gitignore file.
   * @returns A promise that resolves to a sorted array of absolute file paths.
   */
  public async scan(
    workspaceRoot: string,
    config: RepoScribeConfig,
    gitignoreContent: string
  ): Promise<string[]> {
    // 1. Discover All: Start with a list of all files in the workspace.
    const allFiles = await glob.async('**/*', {
      cwd: workspaceRoot,
      dot: true, // Include dotfiles
      absolute: true, // Get absolute paths
      followSymbolicLinks: false,
      onlyFiles: true,
      suppressErrors: true, // Prevent EACCES errors from crashing the scan
    });

    // For filtering, we need paths relative to the workspace root.
    const relativeFiles = allFiles.map((file) =>
      path.relative(workspaceRoot, file)
    );

    // 2. Apply `.gitignore`
    const gitignoreFilter = ignore().add(gitignoreContent);
    const afterGitignore = gitignoreFilter.filter(relativeFiles);

    // 3. Apply Custom `include`
    // If a non-empty `include` array exists, filter the current list,
    // keeping _only_ files that match an `include` pattern.
    let afterInclude = afterGitignore;
    if (config.include && config.include.length > 0) {
      // The 'ignore' library can be used for inclusion by creating a filter
      // that ignores everything (`**/*`) and then un-ignoring the include patterns.
      const includePatterns = ['**/*', ...config.include.map((p) => `!${p}`)];
      const includeFilter = ignore().add(includePatterns);
      afterInclude = includeFilter.filter(afterGitignore);
    }

    // 4. Apply `exclude` (which includes default binary exclusions and custom excludes)
    const excludeFilter = ignore().add(config.exclude);
    const finalRelativeFiles = excludeFilter.filter(afterInclude);

    // Convert back to absolute paths for the final list.
    const finalAbsoluteFiles = finalRelativeFiles.map((file) =>
      path.join(workspaceRoot, file)
    );

    // Final sorting is handled by the domain layer's FileTree builder, which has more
    // complex rules (dirs first), so a simple alphabetical sort here is redundant.
    return finalAbsoluteFiles;
  }
}
