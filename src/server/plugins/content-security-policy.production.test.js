import Hapi from '@hapi/hapi'
import { contentSecurityPolicy } from './content-security-policy.js'

vi.mock('#/config/config.js', () => ({ config: { get: key => key === 'uploader.publicUrl' ? 'https://uploads.example.com' : false } }))

test('production CSP restricts connections, scripts, framing and form destinations', async () => {
  const server = Hapi.server()
  await server.register(contentSecurityPolicy)
  server.route({ method: 'GET', path: '/', handler: () => 'test' })
  try {
    const response = await server.inject('/')
    const policy = response.headers['content-security-policy']
    const connect = policy.split(';').find(value => value.trim().startsWith('connect-src'))
    expect(connect).not.toMatch(/(?:ws:|wss:|data:|\*)\s*(?:;|$)/)
    expect(connect).toContain("'self'")
    expect(policy).not.toContain("'unsafe-inline'")
    expect(policy).not.toContain("'unsafe-eval'")
    expect(policy).toContain("frame-ancestors 'none'")
    expect(policy).toContain("object-src 'none'")
    expect(policy).toContain("form-action 'self' https://uploads.example.com")
  } finally {
    await server.stop({ timeout: 0 })
  }
})
