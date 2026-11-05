import { getUserSession } from './decorators.js'

vi.mock('../../../../config/config.js', () => ({
  config: { get: vi.fn(() => 'userSessionCookie') }
}))

describe('#getUserSession', () => {
  test('returns session from cache when sessionId is in cookie', async () => {
    const mockSession = { id: 'user-1', isAuthenticated: true }
    const request = {
      state: { userSessionCookie: { sessionId: 'session-123' } },
      server: { session: { get: vi.fn().mockResolvedValue(mockSession) } }
    }

    const result = await getUserSession.call(request)

    expect(request.server.session.get).toHaveBeenCalledWith('session-123')
    expect(result).toEqual(mockSession)
  })

  test('returns session when sessionId is passed explicitly', async () => {
    const mockSession = { id: 'user-1', isAuthenticated: true }
    const request = {
      state: {},
      server: { session: { get: vi.fn().mockResolvedValue(mockSession) } }
    }

    const result = await getUserSession.call(request, 'explicit-id')

    expect(request.server.session.get).toHaveBeenCalledWith('explicit-id')
    expect(result).toEqual(mockSession)
  })

  test('returns null when no sessionId is available', async () => {
    const request = {
      state: {},
      server: { session: { get: vi.fn() } }
    }

    const result = await getUserSession.call(request)

    expect(request.server.session.get).not.toHaveBeenCalled()
    expect(result).toBeNull()
  })
})
