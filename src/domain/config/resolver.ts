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
    return baseConfig;
  }

  // Merge user config over base config.
  // For arrays (include, exclude) and primitives (outputFile), user values will replace base values.
  // For languageMap, we'll merge the objects, with user mappings taking precedence.
  return {
    ...baseConfig,
    ...userConfig,
    languageMap: {
      ...baseConfig.languageMap,
      ...userConfig.languageMap,
    },
  };
}
