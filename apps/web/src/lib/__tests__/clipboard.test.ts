// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { copyToClipboard } from '../clipboard';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('copyToClipboard', () => {
  it('uses the async Clipboard API when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await expect(copyToClipboard('hola')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('hola');
  });

  it('falls back to execCommand when the Clipboard API is unavailable (insecure origin)', async () => {
    vi.stubGlobal('navigator', {}); // e.g. plain HTTP: navigator.clipboard is undefined
    const execCommand = vi.fn().mockReturnValue(true);
    (document as unknown as { execCommand: unknown }).execCommand = execCommand;
    await expect(copyToClipboard('code')).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');
    // The temporary textarea must be cleaned up.
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('returns false when both strategies fail', async () => {
    vi.stubGlobal('navigator', {});
    (document as unknown as { execCommand: unknown }).execCommand = vi.fn().mockReturnValue(false);
    await expect(copyToClipboard('nope')).resolves.toBe(false);
  });
});
