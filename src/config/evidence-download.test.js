import { vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

test.each([[undefined, false], ['false', false], ['true', true]])('reads opt-in download access from EVIDENCE_DOWNLOAD_ALLOW_ALL_USERS=%s', async (value, expected) => {
  vi.stubEnv('EVIDENCE_DOWNLOAD_ALLOW_ALL_USERS', value)
  vi.resetModules()
  const { config } = await import('./config.js')
  expect(config.get('evidenceDownload.allowAllUsers')).toBe(expected)
})

test('uses the viewer S3 environment settings and production credential provider chain', async () => {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('S3_ENDPOINT', 'https://s3.example.com')
  vi.stubEnv('AWS_REGION', 'eu-west-1')
  vi.resetModules()
  const { config } = await import('./config.js')
  expect(config.get('evidenceDownload.s3Endpoint')).toBe('https://s3.example.com')
  expect(config.get('evidenceDownload.region')).toBe('eu-west-1')
  expect(config.get('evidenceDownload.accessKeyId')).toBeNull()
  expect(config.get('evidenceDownload.secretAccessKey')).toBeNull()
})

test('preserves the old evidence endpoint setting as a fallback', async () => {
  vi.stubEnv('S3_ENDPOINT', undefined)
  vi.stubEnv('EVIDENCE_S3_ENDPOINT', 'http://localhost:4566')
  vi.resetModules()
  const { config } = await import('./config.js')
  expect(config.get('evidenceDownload.s3Endpoint')).toBe('http://localhost:4566')
})
