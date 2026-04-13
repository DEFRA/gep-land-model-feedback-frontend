import { createServer } from '../../server.js'

describe('#securityHeaders', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  describe('Headers already configured via routes.security and plugins', () => {
    test('Should set Strict-Transport-Security header', async () => {
      const { headers } = await server.inject({
        method: 'GET',
        url: '/'
      })

      expect(headers['strict-transport-security']).toBe(
        'max-age=31536000; includeSubDomains'
      )
    })

    test('Should set X-Frame-Options to DENY', async () => {
      const { headers } = await server.inject({
        method: 'GET',
        url: '/'
      })

      expect(headers['x-frame-options']).toBe('DENY')
    })

    test('Should set X-Content-Type-Options to nosniff', async () => {
      const { headers } = await server.inject({
        method: 'GET',
        url: '/'
      })

      expect(headers['x-content-type-options']).toBe('nosniff')
    })

    test('Should set Content-Security-Policy header', async () => {
      const { headers } = await server.inject({
        method: 'GET',
        url: '/'
      })

      expect(headers['content-security-policy']).toBeDefined()
    })

    test('Should set X-XSS-Protection to 0', async () => {
      const { headers } = await server.inject({
        method: 'GET',
        url: '/'
      })

      expect(headers['x-xss-protection']).toBe('0')
    })

    test('Should set Referrer-Policy to no-referrer', async () => {
      const { headers } = await server.inject({
        method: 'GET',
        url: '/'
      })

      expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
    })
  })

  describe('Headers set via security-headers plugin', () => {
    test('Should set Permissions-Policy header', async () => {
      const { headers } = await server.inject({
        method: 'GET',
        url: '/'
      })

      expect(headers['permissions-policy']).toBe(
        'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
      )
    })

    test('Should set Cross-Origin-Opener-Policy header', async () => {
      const { headers } = await server.inject({
        method: 'GET',
        url: '/'
      })

      expect(headers['cross-origin-opener-policy']).toBe('same-origin')
    })

    test('Should set Cross-Origin-Resource-Policy header', async () => {
      const { headers } = await server.inject({
        method: 'GET',
        url: '/'
      })

      expect(headers['cross-origin-resource-policy']).toBe('same-site')
    })

    test('Should set Cross-Origin-Embedder-Policy header', async () => {
      const { headers } = await server.inject({
        method: 'GET',
        url: '/'
      })

      expect(headers['cross-origin-embedder-policy']).toBe('require-corp')
    })

    test('Should set X-Permitted-Cross-Domain-Policies header', async () => {
      const { headers } = await server.inject({
        method: 'GET',
        url: '/'
      })

      expect(headers['x-permitted-cross-domain-policies']).toBe('none')
    })
  })
})
