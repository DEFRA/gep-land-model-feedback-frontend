import { sessionStrategy } from './session-strategy.js'
import { refreshTokenIfExpired } from './user-session.js'

vi.mock('./user-session.js')
const mockRefreshTokenIfExpired = vi.mocked(refreshTokenIfExpired)

vi.mock('@hapi/cookie', () => ({
  default: { plugin: { name: 'cookie', register: vi.fn() } }
}))

vi.mock('../../../../config/config.js', () => ({
  config: {
    get: vi.fn((key) => {
      const values = {
        'session.cookie': {
          name: 'userSessionCookie',
          password: 'the-password-must-be-at-least-32-characters-long',
          secure: false,
          ttl: 14400000
        }
      }
      return values[key]
    })
  }
}))

describe('#sessionStrategy', () => {
  let server
  let strategyOptions

  beforeEach(async () => {
    vi.clearAllMocks()

    server = {
      register: vi.fn(),
      auth: {
        strategy: vi.fn(),
        default: vi.fn()
      }
    }

    await sessionStrategy.plugin.register(server)
    strategyOptions = server.auth.strategy.mock.calls[0][2]
  })

  test('has the correct plugin name', () => {
    expect(sessionStrategy.plugin.name).toBe('session-strategy')
  })

  test('registers the cookie auth strategy', () => {
    expect(server.auth.strategy).toHaveBeenCalledWith(
      'session',
      'cookie',
      expect.objectContaining({
        cookie: expect.objectContaining({
          name: 'userSessionCookie',
          path: '/'
        }),
        keepAlive: true,
        appendNext: true,
        requestDecoratorName: 'sessionCookie'
      })
    )
    expect(server.auth.default).toHaveBeenCalledWith('session')
  })

  describe('#validate', () => {
    test('returns valid credentials for an authenticated session', async () => {
      const userSession = {
        id: 'user-1',
        displayName: 'Test User',
        isAuthenticated: true,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600000,
        expiresAt: '2025-02-28T01:00:00.000Z'
      }
      mockRefreshTokenIfExpired.mockResolvedValue(undefined)
      const request = {
        getUserSession: vi.fn().mockResolvedValue(userSession),
        server: { oidc: { refresh: vi.fn() } }
      }

      const result = await strategyOptions.validate(
        request,
        { sessionId: 'session-123' }
      )

      expect(result.isValid).toBe(true)
      expect(result.credentials).toEqual(userSession)
    })

    test('returns refreshed credentials when token was refreshed', async () => {
      const userSession = {
        id: 'user-1',
        displayName: 'Test User',
        isAuthenticated: true,
        accessToken: 'old-token',
        refreshToken: 'old-refresh-token',
        expiresIn: 3600000,
        expiresAt: '2025-02-28T01:00:00.000Z'
      }
      const refreshedSession = {
        id: 'user-1',
        displayName: 'Test User',
        isAuthenticated: true,
        accessToken: 'new-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 3600000,
        expiresAt: '2025-02-28T02:00:00.000Z'
      }
      mockRefreshTokenIfExpired.mockResolvedValue(refreshedSession)
      const request = {
        getUserSession: vi.fn().mockResolvedValue(userSession),
        server: { oidc: { refresh: vi.fn() } }
      }

      const result = await strategyOptions.validate(
        request,
        { sessionId: 'session-123' }
      )

      expect(result.isValid).toBe(true)
      expect(result.credentials).toEqual(refreshedSession)
    })

    test('returns invalid when token refresh fails', async () => {
      const refreshError = new Error('refresh token expired')
      const userSession = {
        id: 'user-1',
        displayName: 'Test User',
        isAuthenticated: true,
        accessToken: 'expired-token',
        refreshToken: 'expired-refresh-token',
        expiresIn: 3600000,
        expiresAt: '2025-02-28T01:00:00.000Z'
      }
      mockRefreshTokenIfExpired.mockRejectedValue(refreshError)
      const request = {
        getUserSession: vi.fn().mockResolvedValue(userSession),
        logger: { error: vi.fn() },
        server: { oidc: { refresh: vi.fn() } }
      }

      const result = await strategyOptions.validate(
        request,
        { sessionId: 'session-123' }
      )

      expect(result.isValid).toBe(false)
      expect(request.logger.error).toHaveBeenCalledWith(
        refreshError,
        'User session token refresh failed during validation'
      )
    })

    test('returns invalid for unauthenticated session', async () => {
      const request = {
        getUserSession: vi.fn().mockResolvedValue(null)
      }

      const result = await strategyOptions.validate(
        request,
        { sessionId: 'session-123' }
      )

      expect(result.isValid).toBe(false)
    })
  })

  describe('#redirectTo', () => {
    test('redirects to /auth/login for page navigations', () => {
      const request = {
        headers: { accept: 'text/html' },
        route: { settings: { tags: [] } }
      }
      expect(strategyOptions.redirectTo(request)).toBe('/auth/login')
    })

    test('returns null for JSON requests to prevent redirect', () => {
      const request = {
        headers: { accept: 'application/json' },
        route: { settings: { tags: [] } }
      }
      expect(strategyOptions.redirectTo(request)).toBeNull()
    })

    test('returns null for routes tagged as api', () => {
      const request = {
        headers: { accept: 'text/html' },
        route: { settings: { tags: ['api'] } }
      }
      expect(strategyOptions.redirectTo(request)).toBeNull()
    })

    test('redirects when tags are absent', () => {
      const request = {
        headers: { accept: 'text/html' },
        route: { settings: {} }
      }
      expect(strategyOptions.redirectTo(request)).toBe('/auth/login')
    })
  })
})
