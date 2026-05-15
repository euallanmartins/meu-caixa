export type AppRole =
  | 'platform_admin'
  | 'super_admin'
  | 'owner'
  | 'proprietario'
  | 'admin'
  | 'gerente'
  | 'barbeiro'
  | 'funcionario'
  | 'cliente'
  | 'free'
  | null
  | undefined;

export type AppPermission =
  | 'platform.manage'
  | 'barbearia.manage'
  | 'agenda.manage'
  | 'clientes.manage'
  | 'caixa.manage'
  | 'financeiro.view'
  | 'equipe.manage'
  | 'configuracoes.manage'
  | 'avaliacoes.manage'
  | 'relatorios.view'
  | 'ganhos.view'
  | 'perfil-profissional.manage'
  | 'marketing.manage'
  | 'promocoes.manage'
  | 'formularios.manage'
  | 'suporte.manage';

const PLATFORM_ROLES = new Set(['platform_admin', 'super_admin']);
const OWNER_ROLES = new Set(['owner', 'proprietario']);
const ADMIN_ROLES = new Set(['owner', 'proprietario', 'admin', 'gerente']);

const ROLE_PERMISSIONS: Record<string, AppPermission[]> = {
  platform_admin: ['platform.manage', 'barbearia.manage', 'agenda.manage', 'clientes.manage', 'caixa.manage', 'financeiro.view', 'equipe.manage', 'configuracoes.manage', 'avaliacoes.manage', 'relatorios.view', 'marketing.manage', 'promocoes.manage', 'formularios.manage', 'suporte.manage'],
  super_admin: ['platform.manage', 'barbearia.manage', 'agenda.manage', 'clientes.manage', 'caixa.manage', 'financeiro.view', 'equipe.manage', 'configuracoes.manage', 'avaliacoes.manage', 'relatorios.view', 'marketing.manage', 'promocoes.manage', 'formularios.manage', 'suporte.manage'],
  owner: ['barbearia.manage', 'agenda.manage', 'clientes.manage', 'caixa.manage', 'financeiro.view', 'equipe.manage', 'configuracoes.manage', 'avaliacoes.manage', 'relatorios.view', 'marketing.manage', 'promocoes.manage', 'formularios.manage', 'suporte.manage'],
  proprietario: ['barbearia.manage', 'agenda.manage', 'clientes.manage', 'caixa.manage', 'financeiro.view', 'equipe.manage', 'configuracoes.manage', 'avaliacoes.manage', 'relatorios.view', 'marketing.manage', 'promocoes.manage', 'formularios.manage', 'suporte.manage'],
  admin: ['agenda.manage', 'clientes.manage', 'caixa.manage', 'financeiro.view', 'equipe.manage', 'configuracoes.manage', 'avaliacoes.manage', 'relatorios.view', 'marketing.manage', 'promocoes.manage', 'formularios.manage', 'suporte.manage'],
  gerente: ['agenda.manage', 'clientes.manage', 'caixa.manage', 'financeiro.view', 'equipe.manage', 'configuracoes.manage', 'avaliacoes.manage', 'relatorios.view', 'marketing.manage', 'promocoes.manage', 'formularios.manage', 'suporte.manage'],
  barbeiro: ['agenda.manage', 'ganhos.view', 'perfil-profissional.manage'],
  funcionario: ['agenda.manage', 'clientes.manage', 'caixa.manage', 'suporte.manage'],
};

export function isPlatformRole(role: AppRole) {
  return Boolean(role && PLATFORM_ROLES.has(role));
}

export function isOwnerRole(role: AppRole) {
  return Boolean(role && OWNER_ROLES.has(role));
}

export function isBarbeariaAdminRole(role: AppRole) {
  return Boolean(role && ADMIN_ROLES.has(role));
}

export function hasPermission(role: AppRole, permission: AppPermission) {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function canAccessBarbeariaPanel(role: AppRole, barbeariaId?: string | null) {
  return isPlatformRole(role) || Boolean(barbeariaId && ROLE_PERMISSIONS[String(role)]);
}
