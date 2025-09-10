// src/application/ConfigurationService.ts
import { FileSystem } from '../infrastructure/FileSystem';
import { Logger } from '../infrastructure/Logger';
import { resolveConfig } from '../domain/config/resolver';
import { RepoScribeConfig, BASE_CONFIG } from '../domain/config/types';

// Type alias for the dynamically imported module
type JsoncParseType = typeof import('jsonc-parser').parse;

export interface ConfigContext {
  resolvedConfig: RepoScribeConfig;
  userConfig: Partial<RepoScribeConfig>;
}

/**
 * Manages reading, merging, and caching the RepoScribe configuration.
 * This service ensures that configuration is read from the file system only
 * when necessary, improving performance.
 */
export class ConfigurationService {
  private cachedContext: ConfigContext | null = null;
  private jsoncParse: JsoncParseType | null = null;

  constructor(
    private readonly fs: FileSystem,
    private readonly logger: Logger
  ) {}

  private async getJsoncParse(): Promise<JsoncParseType> {
    if (!this.jsoncParse) {
      this.jsoncParse = (await import('jsonc-parser')).parse;
    }
    return this.jsoncParse;
  }

  /**
   * Retrieves the configuration context, containing both the resolved final
   * configuration and the raw user configuration.
   * If a cached version is available, it's returned immediately.
   * @returns A promise that resolves to the configuration context.
   */
  public async getConfigContext(): Promise<ConfigContext> {
    if (this.cachedContext) {
      this.logger.info('Returning cached configuration context.');
      return this.cachedContext;
    }

    this.logger.info('No cached configuration found. Resolving from file.');

    const configUri = await this.fs.findFile('.reposcribe.jsonc');
    let userConfig: Partial<RepoScribeConfig> = {};

    if (configUri) {
      this.logger.info(`Found config file at: ${configUri.fsPath}`);
      try {
        const jsoncParse = await this.getJsoncParse();
        const configContent = await this.fs.readFile(configUri.fsPath);
        userConfig = jsoncParse(configContent) as Partial<RepoScribeConfig>;
      } catch (error) {
        this.logger.error(
          `Failed to read or parse .reposcribe.jsonc: ${
            (error as Error).message
          }`
        );
        // Continue with base config on error
      }
    } else {
      this.logger.info('No .reposcribe.jsonc found, using default settings.');
    }

    const resolvedConfig = resolveConfig(BASE_CONFIG, userConfig);
    this.cachedContext = { resolvedConfig, userConfig };

    return this.cachedContext;
  }

  /**
   * Invalidates the configuration cache.
   * This should be called whenever the source configuration files change.
   */
  public clearCache(): void {
    this.cachedContext = null;
    this.logger.info('Configuration cache cleared.');
  }
}
