import { authCallbackController } from './callback.js'
import { createUserSession, clearUserSession } from '../common/helpers/auth/user-session.js'

vi.mock('../common/helpers/auth/user-session.js')

const mockCreateUserSession = vi.mocked(createUserSession)

describe('#authCallbackController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('Should have federated-oidc auth', () => {
    expect(authCallbackController.options.auth).toBe('federated-oidc')
  })

  test('Should create session and redirect to referrer', async () => {
    mockCreateUserSession.mockResolvedValue({
      id: 'user-id',
      displayName: 'Test User',
      isAuthenticated: true,
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600000,
      expiresAt: '2025-02-28T01:00:00.000Z'
    })

    const takeover = vi.fn()
    const request = {
      yar: { reset: vi.fn() },
      auth: {
        isAuthenticated: true,
        credentials: { referrer: '/search' }
      },
      sessionCookie: { set: vi.fn() },
      logger: { info: vi.fn() }
    }
    const h = {
      response: vi.fn().mockReturnValue({ takeover })
    }

    await authCallbackController.handler(request, h)

    expect(clearUserSession).toHaveBeenCalledWith(request)
    expect(request.yar.reset).toHaveBeenCalledOnce()
    expect(clearUserSession.mock.invocationCallOrder[0]).toBeLessThan(request.yar.reset.mock.invocationCallOrder[0])
    expect(request.yar.reset.mock.invocationCallOrder[0]).toBeLessThan(mockCreateUserSession.mock.invocationCallOrder[0])
    expect(mockCreateUserSession).toHaveBeenCalledWith(request, expect.any(String))
    expect(request.sessionCookie.set).toHaveBeenCalledWith({
      sessionId: expect.any(String)
    })
    expect(h.response).toHaveBeenCalledWith(
      expect.stringContaining("URL='/search'")
    )
  })

  test('Should redirect to / when no referrer', async () => {
    const takeover = vi.fn()
    const request = {
      yar: { reset: vi.fn() },
      auth: {
        isAuthenticated: false,
        credentials: {}
      },
      logger: { info: vi.fn() }
    }
    const h = {
      response: vi.fn().mockReturnValue({ takeover })
    }

    await authCallbackController.handler(request, h)

    expect(mockCreateUserSession).not.toHaveBeenCalled()
    expect(h.response).toHaveBeenCalledWith(
      expect.stringContaining("URL='/'")
    )
  })
})
