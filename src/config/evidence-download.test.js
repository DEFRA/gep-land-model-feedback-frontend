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
