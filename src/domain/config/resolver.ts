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
    return { ...baseConfig };
  }

  // Combine exclude arrays. Base comes first, then user's patterns are added.
  const combinedExcludes = [
    ...baseConfig.exclude,
    ...(userConfig.exclude || []),
  ];

  return {
    ...baseConfig,
    ...userConfig,
    // Explicitly merge arrays and objects to avoid replacement by the spread operator
    exclude: combinedExcludes,
    include: userConfig.include ?? baseConfig.include, // user 'include' still replaces the base
    languageMap: {
      ...baseConfig.languageMap,
      ...userConfig.languageMap,
    },
  };
}
