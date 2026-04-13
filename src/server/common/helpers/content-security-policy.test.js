import { vi } from 'vitest'
import { createServer } from '../../server.js'

describe('#contentSecurityPolicy', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should set the CSP policy header', async () => {
    const resp = await server.inject({
      method: 'GET',
      url: '/'
    })

    const csp = resp.headers['content-security-policy']
    expect(csp).toBeDefined()
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("form-action 'self'")
  })

  test('Should generate a script nonce', async () => {
    const resp = await server.inject({
      method: 'GET',
      url: '/'
    })

    const csp = resp.headers['content-security-policy']
    expect(csp).toMatch(/script-src 'self' 'nonce-[a-f0-9]+'/)
  })

  test('Should not include GTM domains when container ID is not set', async () => {
    const resp = await server.inject({
      method: 'GET',
      url: '/'
    })

    const csp = resp.headers['content-security-policy']
    expect(csp).not.toContain('googletagmanager.com')
    expect(csp).not.toContain('google-analytics.com')
  })
})

describe('#contentSecurityPolicy with GTM', () => {
  let server

  beforeAll(async () => {
    vi.stubEnv('GTM_CONTAINER_ID', 'GTM-TEST123')
    vi.resetModules()

    const { createServer: createGtmServer } = await import('../../server.js')
    server = await createGtmServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
    vi.unstubAllEnvs()
  })

  test('Should include GTM domains in script-src', async () => {
    const resp = await server.inject({
      method: 'GET',
      url: '/'
    })

    const csp = resp.headers['content-security-policy']
    expect(csp).toContain('https://www.googletagmanager.com')
    expect(csp).toContain('https://www.google-analytics.com')
  })

  test('Should include analytics domains in connect-src', async () => {
    const resp = await server.inject({
      method: 'GET',
      url: '/'
    })

    const csp = resp.headers['content-security-policy']
    expect(csp).toContain('https://analytics.google.com')
    expect(csp).toContain('https://region1.google-analytics.com')
  })

  test('Should include GTM domain in frame-src', async () => {
    const resp = await server.inject({
      method: 'GET',
      url: '/'
    })

    const csp = resp.headers['content-security-policy']
    expect(csp).toMatch(/frame-src 'self' https:\/\/www\.googletagmanager\.com/)
  })
})
