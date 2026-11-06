import { createServer } from '#/server/server.js'
import { config } from '#/config/config.js'
import { mockAuthCredentials } from '#/server/common/test-helpers/auth.js'

let server
const keys = ['issueType', 'issueDescription', 'evidenceFiles', 'evidenceUpload', 'reportedIssue']
beforeAll(async () => {
  server = await createServer()
  server.route({
    method: 'GET',
    path: '/test-session',
    options: { auth: false },
    handler (request) {
      if (request.query.seed) {
        for (const key of keys) request.yar.set(key, `private-${key}`)
        request.sessionCookie.set({ sessionId: 'previous-session' })
      }
      return Object.fromEntries(keys.map(key => [key, request.yar.get(key)]))
    }
  })
  vi.spyOn(server.oidc, 'getConfig').mockResolvedValue({ serverMetadata: () => ({}) })
  await server.initialize()
})
afterAll(() => server.stop({ timeout: 0 }))

test.each(['logout', 'login'])('%s invalidates old authentication and workflow sessions, including replayed cookies', async action => {
  const seeded = await server.inject('/test-session?seed=true')
  expect(seeded.statusCode).toBe(200)
  const cookie = seeded.headers['set-cookie'].map(value => value.split(';')[0]).join('; ')
  await server.session.set('previous-session', mockAuthCredentials.credentials)
  const response = await server.inject({
    url: action === 'logout' ? '/auth/logout' : '/auth/callback',
    headers: { cookie },
    auth: action === 'logout'
      ? mockAuthCredentials
      : {
          strategy: 'federated-oidc',
          credentials: {
            claims: { oid: 'different-user', name: 'New User' },
            expiresIn: 3600,
            accessToken: 'new-access',
            refreshToken: 'new-refresh',
            referrer: '//untrusted.example'
          }
        }
  })
  expect(response.statusCode).toBe(action === 'logout' ? 302 : 200)
  expect(await server.session.get('previous-session')).toBeNull()
  const replay = await server.inject({ url: '/test-session', headers: { cookie } })
  expect(replay.statusCode).toBe(200)
  for (const key of keys) expect(replay.result[key]).toBeNull()
  if (action === 'login') {
    expect(response.payload).toContain("URL='/'")
    const authCookie = response.headers['set-cookie'].find(value => value.startsWith(`${config.get('session.cookie.name')}=`))
    expect(authCookie).toContain('HttpOnly')
    expect(authCookie).toContain('SameSite=Strict')
  }
})
