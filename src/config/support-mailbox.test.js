import { vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

test('uses the configured default support address when the variable is unset', async () => {
  vi.stubEnv('SUPPORT_MAILBOX_ADDRESS', undefined)
  vi.resetModules()
  const { config } = await import('./config.js')
  expect(config.get('supportMailboxAddress')).toBe('example@example.com')
})

test('reads the support mailbox from the environment', async () => {
  vi.stubEnv('SUPPORT_MAILBOX_ADDRESS', 'atlas-support@example.com')
  vi.resetModules()
  const { config } = await import('./config.js')
  expect(config.get('supportMailboxAddress')).toBe('atlas-support@example.com')
})

test.each(['not-an-email', 'support@example.com?subject=test', 'support@example.com\r\nBcc:another@example.com'])('rejects an invalid mailbox: %j', async address => {
  vi.stubEnv('SUPPORT_MAILBOX_ADDRESS', address)
  vi.resetModules()
  await expect(import('./config.js')).rejects.toThrow('supportMailboxAddress')
})
