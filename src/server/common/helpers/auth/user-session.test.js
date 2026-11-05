import { add, sub } from 'date-fns'

import {
  createUserSession,
  updateUserSession,
  clearUserSession,
  refreshTokenIfExpired
} from './user-session.js'

vi.mock('../../../../config/config.js', () => ({
  config: { get: vi.fn(() => 'userSessionCookie') }
}))

describe('#createUserSession', () => {
  beforeAll(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-02-28'))
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  test('creates a user session with correct details', async () => {
    const request = {
      auth: {
        credentials: {
          expiresIn: 3600,
          claims: {
            oid: 'user-id',
            name: 'User Name',
            email: 'user@example.com',
            login_hint: 'user@example.com'
          },
          accessToken: 'access-token',
          refreshToken: 'refresh-token'
        },
        isAuthenticated: true
      },
      server: { session: { set: vi.fn() } }
    }

    await createUserSession(request, 'session-id')

    expect(request.server.session.set).toHaveBeenCalledWith('session-id', {
      id: 'user-id',
      email: 'user@example.com',
      displayName: 'User Name',
      loginHint: 'user@example.com',
      isAuthenticated: true,
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600000,
      expiresAt: expect.any(String)
    })
  })
})

describe('#updateUserSession', () => {
  beforeAll(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-02-28'))
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  test('refreshes the user session with new token and expiry details', async () => {
    const request = {
      logger: { info: vi.fn() },
      state: { userSessionCookie: { sessionId: 'session-id' } },
      server: { session: { set: vi.fn() } }
    }
    const previousSession = {
      id: 'user-id',
      email: 'user@example.com',
      displayName: 'User Name',
      loginHint: 'user@example.com',
      isAuthenticated: true,
      accessToken: 'old-access-token',
      refreshToken: 'old-refresh-token',
      expiresIn: 1800000,
      expiresAt: '2025-02-28T00:30:00.000Z'
    }

    await updateUserSession(request, {
      access_token: 'new-access-token',
      expires_in: 3600,
      refresh_token: 'new-refresh-token'
    }, previousSession)

    expect(request.server.session.set).toHaveBeenCalledWith('session-id', {
      id: 'user-id',
      email: 'user@example.com',
      displayName: 'User Name',
      loginHint: 'user@example.com',
      isAuthenticated: true,
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresIn: 3600000,
      expiresAt: expect.any(String)
    })
    expect(request.logger.info).toHaveBeenCalledWith(
      'User session refreshed, UserId: user-id, displayName: User Name'
    )
  })

  test('preserves previous refresh token when provider omits one', async () => {
    const request = {
      logger: { info: vi.fn() },
      state: { userSessionCookie: { sessionId: 'session-id' } },
      server: { session: { set: vi.fn() } }
    }
    const previousSession = {
      id: 'user-id',
      displayName: 'User Name',
      isAuthenticated: true,
      accessToken: 'old-access-token',
      refreshToken: 'old-refresh-token',
      expiresIn: 1800000,
      expiresAt: '2025-02-28T00:30:00.000Z'
    }

    await updateUserSession(request, {
      access_token: 'new-access-token',
      expires_in: 3600
    }, previousSession)

    expect(request.server.session.set).toHaveBeenCalledWith('session-id',
      expect.objectContaining({
        refreshToken: 'old-refresh-token'
      })
    )
  })

  test('throws when expires_in is missing from the refresh response', async () => {
    const request = {
      logger: { info: vi.fn() },
      state: { userSessionCookie: { sessionId: 'session-id' } },
      server: { session: { set: vi.fn() } }
    }
    const previousSession = {
      id: 'user-id',
      displayName: 'User Name',
      isAuthenticated: true,
      accessToken: 'old-access-token',
      refreshToken: 'old-refresh-token',
      expiresIn: 1800000,
      expiresAt: '2025-02-28T00:30:00.000Z'
    }

    await expect(updateUserSession(request, {
      access_token: 'new-access-token'
    }, previousSession)).rejects.toThrow('Refresh token response did not include expires_in')
  })
})

describe('#clearUserSession', () => {
  test('removes the authenticated user', async () => {
    const request = {
      state: { userSessionCookie: { sessionId: 'session-id' } },
      server: { session: { set: vi.fn(), drop: vi.fn().mockResolvedValue() } },
      sessionCookie: {
        clear: vi.fn(),
        h: {
          unstate: vi.fn().mockReturnThis()
        }
      }
    }

    await clearUserSession(request)

    expect(request.server.session.drop).toHaveBeenCalledWith('session-id')
    expect(request.sessionCookie.clear).toHaveBeenCalled()
    expect(request.sessionCookie.h.unstate).toHaveBeenCalledWith('userSessionCookie')
  })
})

describe('#refreshTokenIfExpired', () => {
  const mockLogger = { info: vi.fn(), debug: vi.fn() }

  test('returns undefined when the token has not expired', async () => {
    const session = {
      id: 'user-id',
      displayName: 'User Name',
      isAuthenticated: true,
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 1800000,
      expiresAt: add(Date.now(), { hours: 1 }).toISOString()
    }

    const result = await refreshTokenIfExpired(async () => ({
      access_token: '',
      expires_in: 0
    }), {
      logger: mockLogger,
      server: { session: { set: vi.fn() } }
    }, session)

    expect(result).toBeUndefined()
  })

  test('refreshes the token if expired', async () => {
    const session = {
      id: 'user-id',
      displayName: 'User Name',
      isAuthenticated: true,
      accessToken: 'old-access-token',
      refreshToken: 'old-refresh-token',
      expiresIn: 1800000,
      expiresAt: sub(Date.now(), { hours: 1 }).toISOString()
    }
    const token = {
      access_token: 'mock token',
      refresh_token: 'mock refresh token',
      expires_in: 1000
    }
    const request = {
      logger: mockLogger,
      state: { userSessionCookie: { sessionId: 'sid' } },
      server: { session: { set: vi.fn() } }
    }

    await refreshTokenIfExpired(vi.fn().mockResolvedValue(token), request, session)

    expect(request.server.session.set).toHaveBeenCalled()
  })

  test('removes session and throws if refresh fails', async () => {
    const request = {
      logger: mockLogger,
      state: { userSessionCookie: { sessionId: 'session-id' } },
      server: { session: { set: vi.fn(), drop: vi.fn() } },
      sessionCookie: {
        clear: vi.fn(),
        h: { unstate: vi.fn() }
      }
    }
    const session = {
      id: 'user-id',
      displayName: 'User Name',
      isAuthenticated: true,
      accessToken: 'old-access-token',
      refreshToken: 'old-refresh-token',
      expiresIn: 1800000,
      expiresAt: sub(Date.now(), { hours: 1 }).toISOString()
    }

    await expect(refreshTokenIfExpired(
      vi.fn().mockRejectedValue(new Error('Token expired')),
      request,
      session
    )).rejects.toThrow('Token expired')

    expect(request.server.session.drop).toHaveBeenCalledWith('session-id')
    expect(request.sessionCookie.clear).toHaveBeenCalled()
  })
})
