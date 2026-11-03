import { describe, it, expect, vi, afterEach } from 'vitest';
import { api, ApiError } from '../api';

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('api client', () => {
  it('returns parsed JSON on success', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { hello: 'world' }));
    await expect(api.get('/x')).resolves.toEqual({ hello: 'world' });
  });

  it('serializes POST body and sends JSON content-type', async () => {
    const f = mockFetch(200, { ok: true });
    vi.stubGlobal('fetch', f);
    await api.post('/x', { a: 1 });
    const [url, opts] = f.mock.calls[0];
    expect(url).toBe('/api/x');
    expect(opts.method).toBe('POST');
    expect(opts.body).toBe(JSON.stringify({ a: 1 }));
    expect(opts.headers['Content-Type']).toBe('application/json');
    expect(opts.credentials).toBe('include');
  });

  it('throws ApiError carrying status, code and issues on failure', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(409, { error: 'Stale state', code: 'STALE_STATE', issues: [{ path: ['x'] }] }),
    );
    await expect(api.put('/x', {})).rejects.toMatchObject({
      status: 409,
      code: 'STALE_STATE',
      message: 'Stale state',
    });
    try {
      await api.get('/x');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).issues).toEqual([{ path: ['x'] }]);
    }
  });

  it('falls back to a generic message when the error body is empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => '' }));
    await expect(api.get('/x')).rejects.toMatchObject({ status: 500, message: 'Request failed' });
  });

  it('treats an empty success body as an empty object', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '' }));
    await expect(api.del('/x')).resolves.toEqual({});
  });
});
