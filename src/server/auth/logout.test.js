import { logoutController } from './logout.js'
import { clearUserSession } from '../common/helpers/auth/user-session.js'

vi.mock('../common/helpers/auth/user-session.js')
vi.mock('../../config/config.js', () => ({
  config: {
    get: vi.fn((key) => {
      const values = {
        appBaseUrl: 'http://localhost:3000'
      }
      return values[key]
    })
  }
}))

const mockEndpoint = 'https://login.microsoftonline.com/tenant/oauth2/v2.0/logout'

function createMockOidc (endSessionEndpoint) {
  return {
    getConfig: vi.fn().mockResolvedValue({
      serverMetadata: () => ({
        end_session_endpoint: endSessionEndpoint
      })
    })
  }
}

describe('#logoutController', () => {
  test('redirects to / when no user session', async () => {
    const request = { auth: { credentials: null } }
    const h = { redirect: vi.fn() }

    await logoutController.handler(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/')
    expect(clearUserSession).not.toHaveBeenCalled()
  })

  test('clears session and redirects to end_session_endpoint', async () => {
    const request = {
      auth: {
        credentials: {
          id: 'user-1',
          displayName: 'Test User',
          loginHint: 'user@example.com'
        }
      },
      server: { oidc: createMockOidc(mockEndpoint) }
    }
    const h = { redirect: vi.fn() }

    await logoutController.handler(request, h)

    expect(clearUserSession).toHaveBeenCalledWith(request)

    const redirectUrl = new URL(h.redirect.mock.calls[0][0])
    expect(redirectUrl.origin + redirectUrl.pathname).toBe(mockEndpoint)
    expect(redirectUrl.searchParams.get('post_logout_redirect_uri')).toBe('http://localhost:3000')
    expect(redirectUrl.searchParams.get('logout_hint')).toBe('user@example.com')
  })

  test('redirects to / when provider has no end_session_endpoint', async () => {
    const request = {
      auth: {
        credentials: {
          id: 'user-1',
          displayName: 'Test User'
        }
      },
      server: { oidc: createMockOidc(undefined) }
    }
    const h = { redirect: vi.fn() }

    await logoutController.handler(request, h)

    expect(clearUserSession).toHaveBeenCalledWith(request)
    expect(h.redirect).toHaveBeenCalledWith('/')
  })

  test('logs warning and redirects to / when getConfig fails', async () => {
    const error = new Error('discovery failed')
    const request = {
      auth: {
        credentials: {
          id: 'user-1',
          displayName: 'Test User'
        }
      },
      server: {
        oidc: {
          getConfig: vi.fn().mockRejectedValue(error)
        }
      },
      logger: { warn: vi.fn() }
    }
    const h = { redirect: vi.fn() }

    await logoutController.handler(request, h)

    expect(clearUserSession).toHaveBeenCalledWith(request)
    expect(request.logger.warn).toHaveBeenCalledWith(
      error,
      'Failed to resolve OIDC end_session_endpoint'
    )
    expect(h.redirect).toHaveBeenCalledWith('/')
  })
})
