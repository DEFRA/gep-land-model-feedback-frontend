afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })

test('reads Notify settings from environment variables and masks the API key', async () => {
  vi.stubEnv('GOV_UK_NOTIFY_API_KEY', 'secret-notify-key')
  vi.stubEnv('GOV_UK_NOTIFY_TEMPLATE_ID', '11111111-1111-4111-8111-111111111111')
  vi.stubEnv('GOV_UK_NOTIFY_EMAIL_SUBJECT', 'New issue')
  vi.resetModules()
  const { config } = await import('./config.js')
  expect(config.get('notify')).toEqual({ apiKey: 'secret-notify-key', templateId: '11111111-1111-4111-8111-111111111111', emailSubject: 'New issue' })
  expect(config.toString()).not.toContain('secret-notify-key')
})

test.each(['not-a-template-id', 'https://example.com/template'])('rejects invalid template ID %s', async value => {
  vi.stubEnv('GOV_UK_NOTIFY_TEMPLATE_ID', value)
  vi.resetModules()
  await expect(import('./config.js')).rejects.toThrow('notify.templateId')
})

test.each(['', '  ', 'Title\nAnother line', 'x'.repeat(201)])('rejects invalid email titles: %j', async value => {
  vi.stubEnv('GOV_UK_NOTIFY_EMAIL_SUBJECT', value)
  vi.resetModules()
  await expect(import('./config.js')).rejects.toThrow('notify.emailSubject')
})
