const ROLE_HOME = {
  admin: '/admin/catalog',
  dispatcher: '/dispatcher/fleet',
  driver: '/driver',
  ops_manager: '/ops',
};

export function homeForRole(role) {
  return ROLE_HOME[role] || '/customer';
}
