import { HttpErrorResponse } from '@angular/common/http';

/** A 429 with Retry-After tells how long to wait, unless the message already says it. */
function withWait(message: string, error: HttpErrorResponse): string {
  const seconds = Number(error.headers?.get('Retry-After'));
  if (error.status !== 429 || !Number.isFinite(seconds) || seconds <= 0 || /segundo/i.test(message)) return message;
  return `${message} Intenta de nuevo en ${Math.ceil(seconds)} s.`;
}

/** Turns any HTTP error into a message the user can read (the backend already answers in Spanish). */
export function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return 'No se pudo conectar con el servidor. Revisa tu conexión; si el servidor estaba dormido, tarda cerca de un minuto en despertar.';
    }
    const detail = (error.error as { detail?: unknown } | null)?.detail;
    if (typeof detail === 'string') return withWait(detail, error);
    if (Array.isArray(detail)) {
      return detail
        .map((d) => (d as { msg?: string }).msg ?? '')
        .filter(Boolean)
        .join('; ');
    }
    if (error.status >= 502 && error.status <= 504) {
      return 'El servidor no está disponible en este momento (puede estar iniciando). Intenta de nuevo en un minuto.';
    }
    if (error.status >= 500) return `Ocurrió un error en el servidor (${error.status}). Intenta de nuevo.`;
    return `Error ${error.status}`;
  }
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado';
}

/** "Python, SQL; Excel" -> ["Python", "SQL", "Excel"] */
export function splitList(text: string): string[] {
  return text
    .split(/[,\n;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Initials for avatars: "Camila Ortega" -> "CO". */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}
