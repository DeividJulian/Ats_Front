/** Copies text to the clipboard. Returns false when the browser does not allow it (then show the text instead). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Public address of a job, the one candidates open from a shared link. */
export function publicJobUrl(jobId: number, origin = location.origin): string {
  return `${origin}/empleos/${jobId}`;
}
