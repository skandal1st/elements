/**
 * Edition management for Elements Platform frontend
 *
 * Controls which modules and features are available based on the edition.
 * Edition is set at build time via VITE_EDITION environment variable.
 */

export enum Edition {
  CORE = 'core',
  ENTERPRISE = 'enterprise'
}

// Current edition - set via environment variable at build time
export const CURRENT_EDITION = (import.meta.env.VITE_EDITION as Edition) || Edition.CORE;

// Module availability mapping for each edition
export const EDITION_MODULES: Record<Edition, string[]> = {
  [Edition.CORE]: ['portal', 'hr', 'it'],
  [Edition.ENTERPRISE]: ['portal', 'hr', 'it', 'tasks', 'knowledge_core']
};

// Feature availability mapping for each edition
export const EDITION_FEATURES: Record<Edition, Record<string, boolean>> = {
  [Edition.CORE]: {
    knowledgeBase: false,
    tasks: false,
    rocketchat: false,
    zabbix: false,
    qdrant: false,
    llm: false
  },
  [Edition.ENTERPRISE]: {
    knowledgeBase: true,
    tasks: true,
    rocketchat: true,
    zabbix: true,
    qdrant: true,
    llm: true
  }
};

/**
 * Checks if a module is available in the current edition
 * @param module Module name (e.g., "tasks", "knowledge_core")
 * @returns true if module is available, false otherwise
 */
export function isModuleAvailable(module: string): boolean {
  return EDITION_MODULES[CURRENT_EDITION].includes(module);
}

/**
 * Checks if a feature is available in the current edition
 * @param feature Feature name (e.g., "rocketchat", "zabbix")
 * @returns true if feature is available, false otherwise
 */
export function isFeatureAvailable(feature: keyof typeof EDITION_FEATURES[Edition.CORE]): boolean {
  return EDITION_FEATURES[CURRENT_EDITION][feature] || false;
}

/**
 * Gets the human-readable edition name
 * @returns Edition name (e.g., "Core", "Enterprise")
 */
export function getEditionName(): string {
  return CURRENT_EDITION === Edition.ENTERPRISE ? 'Enterprise' : 'Core';
}

/**
 * Gets all available modules for the current edition
 * @returns Array of module names
 */
export function getAvailableModules(): string[] {
  return EDITION_MODULES[CURRENT_EDITION];
}
