import { Readable } from 'node:stream'
import { config } from '#/config/config.js'
import { createServer } from '#/server/server.js'
import { mockAuthCredentials } from '#/server/common/test-helpers/auth.js'
import { getEvidence } from '#/server/common/services/evidence/client.js'

vi.mock('#/server/common/services/evidence/client.js', () => ({ getEvidence: vi.fn() }))
const uploadId = '11111111-1111-4111-8111-111111111111'
const fileId = '22222222-2222-4222-8222-222222222222'
const url = `/evidence/download/${uploadId}/${fileId}`
const role = 'Evidence.Reader'
const auth = roles => ({ ...mockAuthCredentials, credentials: { ...mockAuthCredentials.credentials, roles } })
let server
const originalRole = config.get('evidenceDownload.aadRole')
const originalAllowAll = config.get('evidenceDownload.allowAllUsers')
const originalRequired = config.get('auth.required')
beforeAll(async () => {
  config.set('auth.required', true)
  server = await createServer()
  await server.initialize()
})
afterAll(async () => {
  await server.stop({ timeout: 0 })
  config.set('auth.required', originalRequired)
  config.set('evidenceDownload.aadRole', originalRole)
  config.set('evidenceDownload.allowAllUsers', originalAllowAll)
})
afterEach(() => { vi.restoreAllMocks() })
beforeEach(() => {
  for (const method of ['info', 'warn', 'error']) {
    vi.spyOn(console, method).mockImplementation(() => {})
  }
  config.set('evidenceDownload.allowAllUsers', false)
  config.set('auth.required', true)
  config.set('evidenceDownload.aadRole', role)
  getEvidence.mockReset().mockImplementation(async () => ({ Body: Readable.from(['file bytes'], { objectMode: false }), Metadata: { filename: 'Evidence.pdf' } }))
})

test('redirects unauthenticated email recipients to sign in with a return path', async () => {
  const response = await server.inject(url)
  expect(response.statusCode).toBe(302)
  expect(response.headers.location).toBe(`/auth/login?next=${encodeURIComponent(url)}`)
  expect(getEvidence).not.toHaveBeenCalled()
})

test.each([undefined, [], ['Other.Role'], ['evidence.reader'], role])('denies users without the exact role array: %j', async roles => {
  const response = await server.inject({ url, auth: auth(roles) })
  expect(response.statusCode).toBe(403)
  expect(getEvidence).not.toHaveBeenCalled()
})

test('denies downloads when the required role has not been configured', async () => {
  config.set('evidenceDownload.aadRole', '')
  expect((await server.inject({ url, auth: auth([role]) })).statusCode).toBe(403)
  expect(getEvidence).not.toHaveBeenCalled()
})

test('streams evidence for a role holder independently of the uploading session', async () => {
  const response = await server.inject({ url, auth: auth([role]) })
  expect(response.statusCode).toBe(200)
  expect(response.payload).toBe('file bytes')
  expect(getEvidence).toHaveBeenCalledExactlyOnceWith(uploadId, fileId)
  expect(response.headers['content-disposition']).toContain('attachment; filename="Evidence.pdf"')
  expect(response.headers['content-type']).toBe('application/octet-stream')
  expect(response.headers['cache-control']).toContain('no-store')
  expect(response.headers['x-content-type-options']).toBe('nosniff')
})

test('preserves Unicode filenames and their original extensions', async () => {
  const filename = 'étude (1).pdf'
  getEvidence.mockResolvedValue({ Body: Readable.from(['bytes'], { objectMode: false }), Metadata: { encodedfilename: `=?UTF-8?B?${Buffer.from(filename).toString('base64')}?=` } })
  const response = await server.inject({ url, auth: auth([role]) })
  expect(response.statusCode).toBe(200)
  expect(response.headers['content-disposition']).toContain("filename*=UTF-8''%C3%A9tude%20%281%29.pdf")
})

test.each(['not-a-uuid', '../private', '22222222-2222-4222-8222-222222222222.pdf'])('rejects arbitrary keys: %s', async value => {
  const response = await server.inject({ url: `/evidence/download/${uploadId}/${encodeURIComponent(value)}`, auth: auth([role]) })
  expect(response.statusCode).toBe(400)
  expect(getEvidence).not.toHaveBeenCalled()
})

test('returns not found for absent objects and a generic failure for S3 errors', async () => {
  getEvidence.mockRejectedValueOnce({ name: 'NoSuchKey', $metadata: { httpStatusCode: 404 } })
  expect((await server.inject({ url, auth: auth([role]) })).statusCode).toBe(404)
  getEvidence.mockRejectedValueOnce(new Error('private bucket and credentials'))
  const response = await server.inject({ url, auth: auth([role]) })
  expect(response.statusCode).toBe(503)
  expect(response.payload).not.toContain('private')
})

test('rejects unsafe filename metadata and closes the S3 stream', async () => {
  const body = Readable.from(['bytes'], { objectMode: false })
  getEvidence.mockResolvedValue({ Body: body, Metadata: { filename: 'file.pdf\r\nInjected: value' } })
  expect((await server.inject({ url, auth: auth([role]) })).statusCode).toBe(503)
  expect(body.destroyed).toBe(true)
})

test('never exposes evidence while authentication is bypassed', async () => {
  config.set('auth.required', false)
  const bypassServer = await createServer()
  try {
    await bypassServer.initialize()
    expect((await bypassServer.inject(url)).statusCode).toBe(403)
    expect(getEvidence).not.toHaveBeenCalled()
  } finally {
    await bypassServer.stop({ timeout: 0 })
  }
})

test('allows any signed-in user only when the override is explicitly enabled', async () => {
  expect(config.get('evidenceDownload.allowAllUsers')).toBe(false)
  config.set('evidenceDownload.allowAllUsers', true)
  config.set('evidenceDownload.aadRole', '')
  const response = await server.inject({ url, auth: auth([]) })
  expect(response.statusCode).toBe(200)
  expect(console.info).toHaveBeenCalledWith(expect.stringContaining('"allowAllUsers":true'))
})

test('the override still requires sign-in', async () => {
  config.set('evidenceDownload.allowAllUsers', true)
  expect((await server.inject(url)).statusCode).toBe(302)
  expect(getEvidence).not.toHaveBeenCalled()
})

test('the override cannot expose downloads when application authentication is bypassed', async () => {
  config.set('evidenceDownload.allowAllUsers', true)
  config.set('auth.required', false)
  const bypassServer = await createServer()
  try {
    await bypassServer.initialize()
    expect((await bypassServer.inject(url)).statusCode).toBe(403)
    expect(getEvidence).not.toHaveBeenCalled()
  } finally {
    await bypassServer.stop({ timeout: 0 })
  }
})

test.each([[[role], 'info', 'allowed'], [[], 'warn', 'denied']])('intentionally logs identity claims for %s access without session tokens', async (roles, level, outcome) => {
  const claims = { oid: 'user-id', email: 'test@example.com', groups: ['group-id'], roles, customClaim: 'identity-debugging' }
  const credentials = { ...auth(roles).credentials, claims }
  await server.inject({ url, auth: { ...mockAuthCredentials, credentials } })
  const [line] = vi.mocked(console[level]).mock.calls.find(([value]) => value.startsWith(`Evidence download access ${outcome}: `))
  const details = JSON.parse(line.split(': ').slice(1).join(': '))
  expect(details).toMatchObject({ uploadId, fileId, claims, allowAllUsers: false, requiredRole: role })
  expect(line).not.toContain('mock-token')
  expect(line).not.toContain('mock-refresh-token')
})

test('logs the download lifecycle and failure outcomes as console lines', async () => {
  await server.inject({ url, auth: auth([role]) })
  expect(console.info).toHaveBeenCalledWith(expect.stringContaining('Evidence download started: '))
  expect(console.info).toHaveBeenCalledWith(expect.stringContaining('Evidence download stream ended: '))
  getEvidence.mockRejectedValueOnce({ name: 'NoSuchKey' })
  await server.inject({ url, auth: auth([role]) })
  expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Evidence download file not found: '))
  getEvidence.mockRejectedValueOnce(new Error('private storage details'))
  await server.inject({ url, auth: auth([role]) })
  expect(console.error).toHaveBeenCalledWith(expect.stringContaining('"reason":"storage_unavailable"'))
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('private storage details')
})
