import type { UserRole } from '../types';

export const hasPermission = (userRole: UserRole | undefined, requiredRoles: UserRole[]): boolean => {
  if (!userRole) return false;
  return requiredRoles.includes(userRole);
};

export const isAdmin = (userRole: UserRole | undefined): boolean => {
  return userRole === 'admin';
};

export const isITSpecialist = (userRole: UserRole | undefined): boolean => {
  return userRole === 'it_specialist' || userRole === 'admin';
};

export const isEmployee = (userRole: UserRole | undefined): boolean => {
  return !!userRole;
};

export const canManageEquipment = (userRole: UserRole | undefined): boolean => {
  return hasPermission(userRole, ['admin', 'it_specialist']);
};

export const canManageTickets = (userRole: UserRole | undefined): boolean => {
  return hasPermission(userRole, ['admin', 'it_specialist']);
};

export const canViewReports = (userRole: UserRole | undefined): boolean => {
  return hasPermission(userRole, ['admin', 'it_specialist']);
};

export const canManageUsers = (userRole: UserRole | undefined): boolean => {
  return userRole === 'admin';
};

export const canManageSettings = (userRole: UserRole | undefined): boolean => {
  return userRole === 'admin';
};

