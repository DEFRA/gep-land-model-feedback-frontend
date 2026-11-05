import { load } from 'cheerio'
import { vi } from 'vitest'

describe.each([
  ['development', undefined, 'http://localhost:3004', false],
  ['development', 'true', 'http://localhost:3004', false],
  ['development', 'false', 'http://localhost:3004', true],
  ['development', 'false', 'https://deployed.example.com', false],
  ['production', 'false', 'http://localhost:3004', false],
  ['test', 'false', 'http://localhost:3004', false]
])('auth in %s with AUTH_REQUIRED=%s and %s', (nodeEnv, required, baseUrl, bypass) => {
  let server
  beforeAll(async () => {
    vi.stubEnv('NODE_ENV', nodeEnv)
    vi.stubEnv('AUTH_REQUIRED', required)
    vi.stubEnv('APP_BASE_URL', baseUrl)
    vi.stubEnv('SESSION_CACHE_ENGINE', 'memory')
    vi.stubEnv('LOG_ENABLED', 'false')
    vi.resetModules()
    const { config } = await import('#/config/config.js')
    // Keep this integration test offline and avoid starting the Vite dev server/watchers.
    config.set('isTest', true)
    config.set('nunjucks.watch', false)
    const { createServer } = await import('../server.js')
    server = await createServer()
    await server.initialize()
    if (required === undefined) expect(config.get('auth.required')).toBe(true)
  })
  afterAll(async () => {
    await server.stop({ timeout: 0 })
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  test('only bypasses authentication for explicitly opted-out local development', async () => {
    const discovery = vi.spyOn(server.oidc, 'getConfig')
    const page = await server.inject('/')
    expect(page.statusCode).toBe(bypass ? 200 : 302)
    const json = await server.inject({ url: '/', headers: { accept: 'application/json' } })
    expect(json.statusCode).toBe(bypass ? 200 : 401)
    expect(discovery).not.toHaveBeenCalled()
    if (!bypass) {
      expect(page.headers.location).toMatch(/^\/auth\/login/)
      return
    }
    expect(server.info.host).toBe('127.0.0.1')
    const $ = load(page.payload)
    expect($('.defra-header__user-name, .defra-header__sign-out')).toHaveLength(0)
    const cookie = page.headers['set-cookie'].map((value) => value.split(';')[0]).join('; ')
    const crumb = $('form[action="/"] input[name="crumb"]').val()
    const invalid = await server.inject({ method: 'POST', url: '/', headers: { cookie }, payload: { crumb } })
    expect(invalid.statusCode).toBe(400)
    expect(invalid.payload).toContain('Select what type of issue is being reported')
    const unprotected = await server.inject({ method: 'POST', url: '/', payload: { issueType: 'data' } })
    expect(unprotected.statusCode).toBe(403)
    const valid = await server.inject({ method: 'POST', url: '/', headers: { cookie }, payload: { crumb, issueType: 'data' } })
    expect(valid.statusCode).toBe(303)
    expect(valid.headers.location).toBe('/report-issue/data')
    expect(valid.request.yar.get('issueType')).toBe('data')
    const next = await server.inject({ url: valid.headers.location, headers: { cookie: valid.headers['set-cookie'].map((value) => value.split(';')[0]).join('; ') } })
    expect(next.statusCode).toBe(200)
    expect(discovery).not.toHaveBeenCalled()
  })
})
