/**
 * Elements Common - Shared utilities for Elements Platform modules
 */

// Auth exports
export {
  TokenPayload,
  createAccessToken,
  decodeToken,
  verifyToken,
  ALGORITHM,
} from './auth/jwt.js';

export {
  ModuleRBAC,
  hrRbac,
  itRbac,
  financeRbac,
} from './auth/rbac.js';

// Events exports
export {
  EventBus,
  ElementsEvent,
  EventType,
} from './events/index.js';

// Discovery exports
export {
  ModuleRegistry,
  ModuleStatus,
  ModuleInfo,
} from './discovery/registry.js';

// Types exports
export * from './types/index.js';
