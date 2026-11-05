import { load } from 'cheerio'
import { vi } from 'vitest'
import { createServer } from '../server.js'
import { config } from '#/config/config.js'

let server
const cookieName = config.get('session.cookie.name')
const readCookies = (response) => (response.headers['set-cookie'] ?? []).map((value) => value.split(';')[0]).join('; ')

beforeAll(async () => {
  server = await createServer()
  await server.initialize()
})
afterAll(async () => server.stop({ timeout: 0 }))

test('requires login for pages but leaves the health check and assets public', async () => {
  const page = await server.inject('/')
  expect(page.statusCode).toBe(302)
  expect(page.headers.location).toMatch(/^\/auth\/login\?next=/)
  const json = await server.inject({ url: '/', headers: { accept: 'application/json' } })
  expect(json.statusCode).toBe(401)
  expect(json.headers.location).toBeUndefined()
  expect((await server.inject('/health')).statusCode).toBe(200)
  expect((await server.inject('/favicon.ico')).statusCode).toBe(204)
})

test.each(['GET', 'POST'])('OIDC callback creates a usable session and header for %s', async (method) => {
  const response = await server.inject({
    method,
    url: '/auth/callback',
    auth: {
      strategy: 'federated-oidc',
      credentials: {
        expiresIn: 3600,
        claims: { oid: 'integration-user', name: 'Feedback User', email: 'feedback@example.com' },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        referrer: '/about'
      }
    }
  })
  expect(response.statusCode).toBe(200)
  expect(response.payload).toContain("URL='/about'")
  const cookie = readCookies(response)
  expect(cookie).toContain(`${cookieName}=`)
  expect(cookie).not.toContain('access-token')
  const page = await server.inject({ url: '/', headers: { cookie } })
  expect(page.statusCode).toBe(200)
  const $ = load(page.payload)
  expect($('.defra-header__user-name').text()).toBe('Feedback User')
  expect($('.defra-header__sign-out').attr('href')).toBe('/auth/logout')
  expect($('.defra-header__service-name').text()).toBe('Defra Group Land Model Feedback')

  const refresh = vi.spyOn(server.oidc, 'refresh').mockResolvedValue({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600 })
  const state = page.request.state[cookieName]
  const session = await server.session.get(state.sessionId)
  await server.session.set(state.sessionId, { ...session, expiresAt: '2000-01-01T00:00:00.000Z' })
  const refreshed = await server.inject({ url: '/', headers: { cookie } })
  expect(refreshed.statusCode).toBe(200)
  expect(refresh).toHaveBeenCalledWith('refresh-token')
  refresh.mockRestore()

  const getConfig = vi.spyOn(server.oidc, 'getConfig').mockResolvedValue({ serverMetadata: () => ({ end_session_endpoint: 'https://identity.example.com/logout' }) })
  const logout = await server.inject({ url: '/auth/logout', headers: { cookie } })
  expect(logout.statusCode).toBe(302)
  expect(logout.headers.location).toContain('https://identity.example.com/logout?')
  expect(await server.session.get(state.sessionId)).toBeNull()
  expect(logout.headers['set-cookie'].some((value) => value.startsWith(`${cookieName}=`) && value.includes('Max-Age=0'))).toBe(true)
  const expired = await server.inject({ url: '/', headers: { cookie } })
  expect(expired.statusCode).toBe(302)
  getConfig.mockRestore()
})
