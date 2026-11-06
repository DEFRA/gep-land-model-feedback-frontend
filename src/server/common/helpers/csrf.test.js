import Hapi from '@hapi/hapi'
import { csrf } from './csrf.js'

let server
beforeAll(async () => {
  server = Hapi.server()
  await server.register(csrf)
  server.route({ method: ['GET', 'POST'], path: '/{path*}', handler: request => ({ crumb: request.plugins.crumb }) })
  await server.initialize()
})
afterAll(() => server.stop({ timeout: 0 }))

test.each(['/publicity', '/public-upload', '/auth/callback-extra', '/report-issue'])('rejects a CSRF attack against %s', async url => {
  const response = await server.inject({ method: 'POST', url, payload: {} })
  expect(response.statusCode).toBe(403)
})

test('accepts a form with its matching CSRF token and cookie', async () => {
  const page = await server.inject('/publicity')
  const response = await server.inject({
    method: 'POST',
    url: '/publicity',
    payload: { crumb: page.result.crumb },
    headers: { cookie: page.headers['set-cookie'][0].split(';')[0] }
  })
  expect(response.statusCode).toBe(200)
})

test.each(['/public', '/public/assets/example.css', '/auth/callback'])('keeps the intended CSRF exemption for %s', async url => {
  const response = await server.inject({ method: 'POST', url, payload: {} })
  expect(response.statusCode).toBe(200)
})
