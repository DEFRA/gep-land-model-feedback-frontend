import { config } from '#/config/config.js'
import { initiateUpload, getUploadStatus, uploadUrl } from './upload.js'

const id = '11111111-1111-4111-8111-111111111111'
const request = vi.fn()
const originals = { api: config.get('uploader.apiUrl'), public: config.get('uploader.publicUrl') }
beforeEach(() => {
  request.mockReset()
  vi.stubGlobal('fetch', request)
})
afterEach(() => {
  vi.unstubAllGlobals()
  config.set('uploader.apiUrl', originals.api)
  config.set('uploader.publicUrl', originals.public)
})
const success = json => ({ ok: true, status: 200, json: async () => json })

test('initiates with a return route, bucket, size limit and session correlation token', async () => {
  config.set('uploader.apiUrl', 'http://uploader.internal/')
  request.mockResolvedValue(success({ uploadId: id, uploadUrl: 'https://untrusted.invalid', statusUrl: 'https://untrusted.invalid' }))
  expect(await initiateUpload('/report-issue/evidence/complete', 'session-token')).toBe(id)
  expect(request.mock.calls[0][0]).toBe('http://uploader.internal/initiate')
  const options = request.mock.calls[0][1]
  expect(options.signal).toBeInstanceOf(AbortSignal)
  expect(JSON.parse(options.body)).toEqual({ redirect: '/report-issue/evidence/complete', s3Bucket: config.get('uploader.bucket'), s3Path: 'evidence', maxFileSize: 100000000, metadata: { evidenceToken: 'session-token' } })
})
test.each([undefined, 'not-a-uuid'])('rejects invalid initiation IDs: %j', async uploadId => {
  request.mockResolvedValue(success({ uploadId }))
  await expect(initiateUpload('/complete', 'token')).rejects.toThrow('Invalid')
})
test('constructs browser form URLs from configured origin or same-origin CDP path', () => {
  config.set('uploader.publicUrl', 'http://localhost:7337/')
  expect(uploadUrl(id)).toBe(`http://localhost:7337/upload-and-scan/${id}`)
  config.set('uploader.publicUrl', '')
  expect(uploadUrl(id)).toBe(`/upload-and-scan/${id}`)
})
test.each(['initiated', 'pending', 'ready'])('fetches private %s status and requires the stored correlation token', async uploadStatus => {
  request.mockResolvedValue(success({ uploadStatus, metadata: { evidenceToken: 'token' }, form: {} }))
  expect((await getUploadStatus(id, 'token')).uploadStatus).toBe(uploadStatus)
  expect(request.mock.calls[0][0]).toBe(`${originals.api.replace(/\/$/, '')}/status/${id}`)
})
test.each([
  { uploadStatus: 'unknown', metadata: { evidenceToken: 'token' }, form: {} },
  { uploadStatus: 'ready', metadata: { evidenceToken: 'someone-else' }, form: {} },
  { uploadStatus: 'ready', form: {} },
  { uploadStatus: 'ready', metadata: { evidenceToken: 'token' }, form: [] },
  { uploadStatus: 'ready', metadata: { evidenceToken: 'token' } }
])('rejects malformed or foreign status: %j', async status => {
  request.mockResolvedValue(success(status))
  await expect(getUploadStatus(id, 'token')).rejects.toThrow('Invalid')
})
test('consumes upstream failure responses and retains their status for expiry handling', async () => {
  const cancel = vi.fn()
  request.mockResolvedValue({ ok: false, status: 404, body: { cancel } })
  await expect(getUploadStatus(id, 'token')).rejects.toMatchObject({ statusCode: 404 })
  expect(cancel).toHaveBeenCalledOnce()
})
test('propagates network and JSON failures', async () => {
  request.mockRejectedValueOnce(new Error('Network unavailable'))
  await expect(initiateUpload('/complete', 'token')).rejects.toThrow('Network unavailable')
  request.mockResolvedValueOnce({ ok: true, json: async () => { throw new SyntaxError('Invalid JSON') } })
  await expect(getUploadStatus(id, 'token')).rejects.toThrow('Invalid JSON')
})
