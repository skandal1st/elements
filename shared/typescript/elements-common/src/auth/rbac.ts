/**
 * Role-Based Access Control (RBAC) for Elements modules.
 *
 * Each module has its own role system:
 * - hr: admin, manager, specialist, viewer
 * - it: admin, it_specialist, employee
 * - finance: admin, accountant, economist, viewer
 *
 * User roles are stored in JWT as:
 * {"hr": "admin", "it": "user", "finance": "viewer"}
 */

/**
 * Role-based access control for a specific module
 */
export class ModuleRBAC {
  constructor(private moduleName: string) {}

  /**
   * Get user's role in this module
   */
  getUserRole(roles: Record<string, string>): string | undefined {
    return roles[this.moduleName];
  }

  /**
   * Check if user has any access to this module
   */
  hasAccess(roles: Record<string, string>, isSuperuser: boolean = false): boolean {
    if (isSuperuser) return true;
    return this.moduleName in roles;
  }

  /**
   * Check if user has one of the required roles
   */
  hasRole(
    roles: Record<string, string>,
    requiredRoles: string[],
    isSuperuser: boolean = false
  ): boolean {
    if (isSuperuser) return true;

    const userRole = this.getUserRole(roles);
    if (!userRole) return false;

    return requiredRoles.includes(userRole);
  }

  /**
   * Check if user is admin in this module
   */
  isAdmin(roles: Record<string, string>, isSuperuser: boolean = false): boolean {
    if (isSuperuser) return true;
    return this.getUserRole(roles) === 'admin';
  }
}

// Pre-configured RBAC instances for each module
export const hrRbac = new ModuleRBAC('hr');
export const itRbac = new ModuleRBAC('it');
export const financeRbac = new ModuleRBAC('finance');
export const docRbac = new ModuleRBAC('doc');
