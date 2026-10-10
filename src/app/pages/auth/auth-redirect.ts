import { Role } from '../../core/models';
import { homeFor } from '../../core/auth/auth.service';

/**
 * Where to go after logging in: the page the user wanted, if it is ours and fits their role,
 * or otherwise their home. External URLs are never followed.
 */
export function afterLoginUrl(redirect: string | null | undefined, role: Role): string {
  const home = homeFor(role);
  if (!redirect || !redirect.startsWith('/') || redirect.startsWith('//')) return home;
  if (redirect.startsWith('/app') && role === 'candidate') return home;
  if (redirect.startsWith('/portal') && role !== 'candidate') return home;
  return redirect;
}
