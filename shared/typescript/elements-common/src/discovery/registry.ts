/**
 * Module discovery and registry for Elements Platform.
 */

export enum ModuleStatus {
  HEALTHY = 'healthy',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown',
}

export interface ModuleInfo {
  name: string;
  baseUrl: string;
  healthEndpoint: string;
  status: ModuleStatus;
  lastCheck?: string;
  version?: string;
}

export class ModuleRegistry {
  private modules: Map<string, ModuleInfo> = new Map();
  private timeout: number;

  constructor(timeout: number = 5000) {
    this.timeout = timeout;
  }

  /**
   * Register a module
   */
  register(name: string, baseUrl: string, healthEndpoint: string = '/health'): void {
    this.modules.set(name, {
      name,
      baseUrl: baseUrl.replace(/\/$/, ''),
      healthEndpoint,
      status: ModuleStatus.UNKNOWN,
    });
    console.log(`[Registry] Registered module: ${name} at ${baseUrl}`);
  }

  /**
   * Register modules from environment variables
   */
  registerFromEnv(envPrefix: string = 'MODULE'): void {
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(`${envPrefix}_`) && key.endsWith('_URL') && value) {
        const moduleName = key
          .slice(envPrefix.length + 1, -4)
          .toLowerCase();
        this.register(moduleName, value);
      }
    }
  }

  /**
   * Check health of a specific module
   */
  async checkHealth(moduleName: string): Promise<ModuleStatus> {
    const module = this.modules.get(moduleName);
    if (!module) return ModuleStatus.UNKNOWN;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(
        `${module.baseUrl}${module.healthEndpoint}`,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      if (response.ok) {
        module.status = ModuleStatus.HEALTHY;
        try {
          const data = await response.json();
          module.version = data.version;
        } catch {
          // Ignore JSON parse errors
        }
      } else {
        module.status = ModuleStatus.UNHEALTHY;
      }
    } catch (error) {
      console.warn(`[Registry] Health check failed for ${moduleName}:`, error);
      module.status = ModuleStatus.UNHEALTHY;
    }

    module.lastCheck = new Date().toISOString();
    return module.status;
  }

  /**
   * Check health of all registered modules
   */
  async checkAll(): Promise<Map<string, ModuleStatus>> {
    const results = new Map<string, ModuleStatus>();
    for (const name of this.modules.keys()) {
      results.set(name, await this.checkHealth(name));
    }
    return results;
  }

  /**
   * Check if module is registered and healthy
   */
  isAvailable(moduleName: string): boolean {
    const module = this.modules.get(moduleName);
    return module !== undefined && module.status === ModuleStatus.HEALTHY;
  }

  /**
   * Get base URL for a module if available
   */
  getUrl(moduleName: string): string | undefined {
    return this.modules.get(moduleName)?.baseUrl;
  }

  /**
   * Get module info
   */
  getModule(moduleName: string): ModuleInfo | undefined {
    return this.modules.get(moduleName);
  }

  /**
   * List all registered modules
   */
  listModules(): ModuleInfo[] {
    return Array.from(this.modules.values());
  }

  /**
   * Export registry state as object
   */
  toObject(): Record<string, Omit<ModuleInfo, 'name'>> {
    const result: Record<string, Omit<ModuleInfo, 'name'>> = {};
    for (const [name, module] of this.modules.entries()) {
      const { name: _, ...rest } = module;
      result[name] = rest;
    }
    return result;
  }
}
