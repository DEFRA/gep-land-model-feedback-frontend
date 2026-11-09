import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

const { send, settings } = vi.hoisted(() => ({ send: vi.fn(), settings: {} }))
vi.mock('../../helpers/logging/logger.js', () => ({ logExternalCall: (_service, _operation, call) => call() }))
vi.mock('#/config/config.js', () => ({ config: { get: key => settings[key] } }))
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(function () { this.send = send }),
  GetObjectCommand: vi.fn(function (input) { this.input = input }),
  HeadObjectCommand: vi.fn(function (input) { this.input = input })
}))
const uploadId = '11111111-1111-4111-8111-111111111111'
const fileId = '22222222-2222-4222-8222-222222222222'
let getEvidence, getEvidenceMetadata, isMissingEvidence
beforeEach(async () => {
  send.mockReset()
  S3Client.mockClear()
  Object.assign(settings, {
    'uploader.bucket': 'clean-evidence',
    'evidenceDownload.region': 'eu-west-2',
    'evidenceDownload.s3Endpoint': '',
    'evidenceDownload.accessKeyId': null,
    'evidenceDownload.secretAccessKey': null
  })
  vi.resetModules()
  ;({ getEvidence, getEvidenceMetadata, isMissingEvidence } = await import('./client.js'))
})

test('uses the viewer client configuration and propagates cancellation for streamed downloads', async () => {
  const result = { Body: 'stream', Metadata: { filename: 'original.pdf' } }
  const signal = new AbortController().signal
  send.mockResolvedValue(result)
  expect(await getEvidence(uploadId, fileId, signal)).toBe(result)
  expect(S3Client).toHaveBeenCalledWith({
    region: 'eu-west-2',
    endpoint: undefined,
    forcePathStyle: false,
    requestHandler: { requestTimeout: 10000, throwOnRequestTimeout: true },
    credentials: undefined
  })
  expect(GetObjectCommand).toHaveBeenCalledWith({ Bucket: 'clean-evidence', Key: `evidence/${uploadId}/${fileId}` })
  expect(send).toHaveBeenCalledWith(expect.any(GetObjectCommand), { abortSignal: signal })
  await getEvidence(uploadId, fileId, signal)
  expect(S3Client).toHaveBeenCalledOnce()
})

test('uses path-style access and development credentials for a local S3 endpoint', async () => {
  settings['evidenceDownload.s3Endpoint'] = 'http://localhost:4566'
  settings['evidenceDownload.accessKeyId'] = 'test'
  settings['evidenceDownload.secretAccessKey'] = 'test-secret'
  await getEvidence(uploadId, fileId, new AbortController().signal)
  expect(S3Client).toHaveBeenCalledWith(expect.objectContaining({
    endpoint: 'http://localhost:4566',
    forcePathStyle: true,
    credentials: { accessKeyId: 'test', secretAccessKey: 'test-secret' }
  }))
})

test('HEAD reads only metadata with cancellation support', async () => {
  const signal = new AbortController().signal
  const metadata = { ContentLength: 100, Metadata: { filename: 'evidence.pdf' } }
  send.mockResolvedValue(metadata)
  expect(await getEvidenceMetadata(uploadId, fileId, signal)).toBe(metadata)
  expect(HeadObjectCommand).toHaveBeenCalledWith({ Bucket: 'clean-evidence', Key: `evidence/${uploadId}/${fileId}` })
  expect(send).toHaveBeenCalledWith(expect.any(HeadObjectCommand), { abortSignal: signal })
})

test.each([['../private', fileId], [uploadId, 'private/key'], [undefined, fileId]])('rejects arbitrary keys before contacting S3', async (upload, file) => {
  await expect(getEvidence(upload, file)).rejects.toThrow('Invalid evidence download IDs')
  await expect(getEvidenceMetadata(upload, file)).rejects.toThrow('Invalid evidence download IDs')
  expect(send).not.toHaveBeenCalled()
})

test('distinguishes absent objects from bucket configuration failures like the viewer', () => {
  expect(isMissingEvidence({ name: 'NoSuchKey' })).toBe(true)
  expect(isMissingEvidence({ $metadata: { httpStatusCode: 404 } })).toBe(true)
  expect(isMissingEvidence({ name: 'NoSuchBucket', $metadata: { httpStatusCode: 404 } })).toBe(false)
  expect(isMissingEvidence({ $metadata: { httpStatusCode: 403 } })).toBe(false)
})
