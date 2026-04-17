import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import { clearStoredToken, getStoredToken, setStoredToken } from './storage';

describe('api auth refresh flow', () => {
  beforeEach(() => {
    clearStoredToken();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearStoredToken();
  });

  it('retries a protected request after refreshing the access token', async () => {
    setStoredToken('expired-token');

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: { id: 1, username: 'alice', email: 'alice@test.com' },
            token: 'fresh-token',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ user: { id: 1, username: 'alice', email: 'alice@test.com' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    vi.stubGlobal('fetch', fetchMock);

    const response = await api.auth.me();

    expect(response.user.email).toBe('alice@test.com');
    expect(getStoredToken()).toBe('fresh-token');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toContain('/auth/refresh');
  });
});
