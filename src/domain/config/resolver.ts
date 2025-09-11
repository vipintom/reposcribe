// src/domain/config/resolver.ts
import type { RepoScribeConfig } from './types';

/**
 * A pure function that merges a user-provided partial configuration
 * over a base configuration. User values take precedence.
 *
 * @param baseConfig The default configuration object.
 * @param userConfig An optional partial configuration from the user.
 * @returns A new, complete configuration object.
 */
export function resolveConfig(
  baseConfig: RepoScribeConfig,
  userConfig?: Partial<RepoScribeConfig>
): RepoScribeConfig {
  if (!userConfig) {
    // Return a copy to prevent mutation of the base config
    return { ...baseConfig };
  }

  // Explicitly build the final config to ensure correct merging,
  // especially for arrays.
  const resolved: RepoScribeConfig = {
    outputFile: userConfig.outputFile ?? baseConfig.outputFile,
    include: userConfig.include ?? baseConfig.include,
    // Combine the base exclude list with the user's list.
    exclude: [...baseConfig.exclude, ...(userConfig.exclude || [])],
    languageMap: {
      ...baseConfig.languageMap,
      ...(userConfig.languageMap || {}),
    },
    regenerationDelay:
      userConfig.regenerationDelay ?? baseConfig.regenerationDelay,
    maxFileSizeKb: userConfig.maxFileSizeKb ?? baseConfig.maxFileSizeKb,
  };

  return resolved;
}
