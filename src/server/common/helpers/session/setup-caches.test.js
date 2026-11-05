import { setupCaches } from './setup-caches.js'

vi.mock('../../../../config/config.js', () => ({
  config: {
    get: vi.fn(() => ({
      cache: { name: 'session', segment: 'session', ttl: 14400000 }
    }))
  }
}))

describe('#setupCaches', () => {
  test('Should create cache and decorate server', () => {
    const mockCache = { get: vi.fn(), set: vi.fn(), drop: vi.fn() }
    const server = {
      cache: vi.fn().mockReturnValue(mockCache),
      decorate: vi.fn()
    }

    setupCaches(server)

    expect(server.cache).toHaveBeenCalledWith({
      cache: 'session',
      segment: 'session',
      expiresIn: 14400000
    })
    expect(server.decorate).toHaveBeenCalledWith('server', 'session', mockCache)
    expect(server.decorate).toHaveBeenCalledTimes(1)
  })
})
