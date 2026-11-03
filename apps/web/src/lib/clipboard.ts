/**
 * Copy text to the clipboard with a fallback for insecure contexts.
 *
 * `navigator.clipboard` only exists on secure origins (HTTPS or localhost).
 * When the app is reached over plain HTTP (e.g. a public IP during testing),
 * it is `undefined` and the async API throws — so we fall back to the legacy
 * `document.execCommand('copy')` trick with a temporary textarea.
 *
 * Returns `true` when the copy succeeded, `false` otherwise.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Preferred: async Clipboard API (secure contexts).
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy approach.
  }

  // Fallback: hidden textarea + execCommand.
  try {
    if (typeof document === 'undefined') return false;
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-1000px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
