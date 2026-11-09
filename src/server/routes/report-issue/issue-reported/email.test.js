import { config } from '#/config/config.js'
import { sendIssueEmail } from '#/server/routes/report-issue/issue-reported/email.js'
import axios from 'axios'
import { setTimeout as delay } from 'node:timers/promises'
import { randomUUID } from 'node:crypto'

const { transport } = vi.hoisted(() => ({ transport: vi.fn() }))
vi.mock('axios', () => ({ default: { create: vi.fn(() => transport) } }))
vi.mock('node:timers/promises', () => ({ setTimeout: vi.fn(async () => {}) }))

const originalSettings = config.get('notify')
const originalMailbox = config.get('supportMailboxAddress')
const report = {
  id: '12345678-1234-4123-8123-123456789012',
  reference: '123456781234',
  answers: { submitterEmail: 'reporter@example.com', files: [{ filename: 'evidence.png', s3Key: 'private-key', uploadId: '11111111-1111-4111-8111-111111111111', fileId: '22222222-2222-4222-8222-222222222222' }, { filename: 'details.pdf', uploadId: '11111111-1111-4111-8111-111111111111', fileId: '33333333-3333-4333-8333-333333333333' }] }
}
const rows = [{ label: 'Issue type', lines: ['Data issue'] }, { label: 'Description', lines: ['First line', 'Second line'] }, { label: 'Files', lines: ['evidence.png', 'details.pdf'] }]
const logger = { info: vi.fn(), warn: vi.fn() }
beforeEach(() => {
  delete report.notification
  config.set('notify', {
    // Generate synthetic credentials for the SDK; all HTTP requests are mocked.
    apiKey: ['test', randomUUID(), randomUUID()].join('-'),
    templateId: '33333333-3333-4333-8333-333333333333',
    emailSubject: 'New ATLAS report'
  })
  config.set('supportMailboxAddress', 'support@example.com')
  transport.mockReset().mockResolvedValue({ status: 201, data: { id: 'notification-id' } })
})
afterEach(() => {
  config.set('notify', originalSettings)
  config.set('supportMailboxAddress', originalMailbox)
})

test('uses the Notify SDK to send the reference, exact answer text and authenticated file links', async () => {
  expect(await sendIssueEmail(report, rows, logger)).toEqual({ id: 'notification-id', recipient: 'support@example.com', submitterCopy: { id: 'notification-id', recipient: 'reporter@example.com' } })
  expect(axios.create).toHaveBeenCalledWith({ timeout: 10000 })
  expect(transport).toHaveBeenCalledTimes(2)
  expect(transport.mock.calls[0][0]).toMatchObject({
    method: 'post',
    url: 'https://api.notifications.service.gov.uk/v2/notifications/email',
    data: {
      template_id: config.get('notify.templateId'),
      email_address: 'support@example.com',
      reference: report.id,
      personalisation: {
        email_subject: 'New ATLAS report - 123456781234',
        reference: report.reference,
        submitter_email: 'reporter@example.com',
        answers: '## Issue type\nData issue\n\n## Description\nFirst line\nSecond line\n\n## Files\nevidence.png\ndetails.pdf',
        include_file_downloads: 'yes',
        file_downloads: `[evidence.png](${config.get('appBaseUrl')}/evidence/download/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222)\n\n[details.pdf](${config.get('appBaseUrl')}/evidence/download/11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333)`
      }
    }
  })
  expect(JSON.stringify(transport.mock.calls[0][0].data)).not.toContain('private-key')
})

test('provides a no-files value for the template', async () => {
  await sendIssueEmail({ ...report, answers: { files: [] } }, rows, logger)
  expect(transport.mock.calls[0][0].data.personalisation.file_downloads).toBe('No files added')
})

test.each([null, undefined])('provides an explicit fallback when a submitter email is unavailable: %j', async submitterEmail => {
  await sendIssueEmail({ ...report, answers: { ...report.answers, submitterEmail } }, rows, logger)
  expect(transport.mock.calls[0][0].data.personalisation.submitter_email).toBe('Not available')
})

test.each([408, 429, 500, 502, 503, 504])('retries temporary HTTP %s failures with exponential backoff and the same reference', async status => {
  transport.mockRejectedValueOnce({ response: { status } }).mockRejectedValueOnce({ response: { status } })
  await sendIssueEmail(report, rows, logger)
  expect(transport).toHaveBeenCalledTimes(4)
  expect(delay.mock.calls).toEqual([[1000], [2000]])
  expect(transport.mock.calls.map(([options]) => options.data.reference)).toEqual([report.id, report.id, report.id, report.id])
  expect(transport.mock.calls.map(([options]) => options.data.personalisation.submitter_email)).toEqual(Array(4).fill('reporter@example.com'))
})

test.each(['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'EAI_AGAIN', 'ECONNREFUSED', 'ENOTFOUND', 'EPIPE', 'ERR_NETWORK'])('retries temporary network error %s', async code => {
  transport.mockRejectedValueOnce({ code })
  await sendIssueEmail(report, rows, logger)
  expect(transport).toHaveBeenCalledTimes(3)
})

test.each([400, 401, 403, 404, 422])('does not retry permanent HTTP %s failures', async status => {
  transport.mockRejectedValue({ response: { status } })
  await expect(sendIssueEmail(report, rows, logger)).rejects.toThrow('could not be sent')
  expect(transport).toHaveBeenCalledOnce()
  expect(delay).not.toHaveBeenCalled()
})

test('stops after three attempts and avoids logging the SDK error or personalisation', async () => {
  transport.mockRejectedValue({ response: { status: 503, data: 'secret-api-key' }, config: { personalisation: 'private description' } })
  await expect(sendIssueEmail(report, rows, logger)).rejects.toThrow('could not be sent')
  expect(transport).toHaveBeenCalledTimes(3)
  expect(JSON.stringify(logger.warn.mock.calls)).not.toMatch(/secret-api-key|private description|support@example.com|reporter@example.com/)
})

test.each(['2', new Date(Date.now() + 2000).toUTCString(), 'invalid'])('handles Retry-After %s', async retryAfter => {
  transport.mockRejectedValueOnce({ response: { status: 429, headers: { 'retry-after': retryAfter } } })
  await sendIssueEmail(report, rows, logger)
  expect(transport).toHaveBeenCalledTimes(3)
  expect(delay.mock.calls[0][0]).toBeGreaterThanOrEqual(0)
  expect(delay.mock.calls[0][0]).toBeLessThanOrEqual(2000)
})

test('returns control without retrying before a long Retry-After expires', async () => {
  transport.mockRejectedValue({ response: { status: 429, headers: { 'retry-after': '60' } } })
  await expect(sendIssueEmail(report, rows, logger)).rejects.toThrow()
  expect(transport).toHaveBeenCalledOnce()
  expect(delay).not.toHaveBeenCalled()
})

test.each(['apiKey', 'templateId', 'recipient'])('requires %s before sending', async field => {
  if (field === 'recipient') {
    config.set('supportMailboxAddress', null)
  } else {
    config.set(`notify.${field}`, '')
  }
  await expect(sendIssueEmail(report, rows, logger)).rejects.toThrow('not configured')
  expect(transport).not.toHaveBeenCalled()
})

test('rejects a response without a notification ID without pretending the email was accepted', async () => {
  transport.mockResolvedValue({ status: 201, data: {} })
  await expect(sendIssueEmail(report, rows, logger)).rejects.toThrow('could not be sent')
  expect(transport).toHaveBeenCalledOnce()
})

test('escapes filenames so they cannot replace the email download destination', async () => {
  const file = { ...report.answers.files[0], filename: 'Evidence [map](https://untrusted.example)!.png' }
  await sendIssueEmail({ ...report, answers: { ...report.answers, files: [file] } }, rows, logger)
  const { file_downloads: links } = transport.mock.calls[0][0].data.personalisation
  expect(links).toContain('Evidence \\[map\\]\\(https://untrusted.example\\)\\!.png')
  expect(links).toContain(`](${config.get('appBaseUrl')}/evidence/download/${file.uploadId}/${file.fileId})`)
})

test('uses one template and hides the entire downloads section in the submitter copy', async () => {
  await sendIssueEmail(report, rows, logger)
  const [support, copy] = transport.mock.calls.map(([options]) => options.data)
  expect(copy).toEqual({
    template_id: config.get('notify.templateId'),
    email_address: report.answers.submitterEmail,
    reference: report.id,
    personalisation: {
      email_subject: support.personalisation.email_subject,
      reference: report.reference,
      submitter_email: report.answers.submitterEmail,
      answers: support.personalisation.answers,
      include_file_downloads: 'no',
      file_downloads: ''
    }
  })
  expect(support.personalisation.include_file_downloads).toBe('yes')
  expect(JSON.stringify(copy)).not.toMatch(/\/evidence\/download\/|private-key/)
  await sendIssueEmail(report, rows, logger)
  expect(transport).toHaveBeenCalledTimes(2)
})

test('retries only the submitter copy after support has accepted the report', async () => {
  transport.mockResolvedValueOnce({ status: 201, data: { id: 'support-id' } })
    .mockRejectedValueOnce({ response: { status: 400 } })
  await expect(sendIssueEmail(report, rows, logger)).rejects.toThrow('could not be sent')
  expect(report.notification).toEqual({ id: 'support-id', recipient: 'support@example.com' })
  await sendIssueEmail(report, rows, logger)
  expect(transport.mock.calls.map(([options]) => options.data.email_address)).toEqual([
    'support@example.com', 'reporter@example.com', 'reporter@example.com'
  ])
  expect(report.notification.submitterCopy).toMatchObject({ id: 'notification-id' })
})

test('sends only to support when there is no signed-in email address', async () => {
  await sendIssueEmail({ ...report, answers: { ...report.answers, submitterEmail: null } }, rows, logger)
  expect(transport).toHaveBeenCalledOnce()
  expect(logger.info).toHaveBeenCalledWith({ reference: report.id, recipientType: 'submitter' }, 'Submitter copy skipped: no email address available')
})

test('saves support acceptance before starting the submitter copy and saves both acceptances', async () => {
  const saved = []
  const onAccepted = vi.fn(async () => {
    saved.push(structuredClone(report.notification))
    expect(transport).toHaveBeenCalledTimes(saved.length)
  })
  await sendIssueEmail(report, rows, logger, onAccepted)
  expect(saved).toEqual([
    { id: 'notification-id', recipient: 'support@example.com' },
    { id: 'notification-id', recipient: 'support@example.com', submitterCopy: { id: 'notification-id', recipient: 'reporter@example.com' } }
  ])
})

test('stops before the copy if saving support acceptance fails', async () => {
  await expect(sendIssueEmail(report, rows, logger, async () => { throw new Error('Cache unavailable') })).rejects.toThrow('Cache unavailable')
  expect(transport).toHaveBeenCalledOnce()
  expect(report.notification).toEqual({ id: 'notification-id', recipient: 'support@example.com' })
})

test('identifies each accepted email in diagnostics without exposing recipients or report contents', async () => {
  await sendIssueEmail(report, rows, logger)
  expect(logger.info).toHaveBeenCalledWith({ reference: report.id, recipientType: 'support', attempt: 1, notificationId: 'notification-id' }, 'Issue email accepted by GOV.UK Notify')
  expect(logger.info).toHaveBeenCalledWith({ reference: report.id, recipientType: 'submitter', attempt: 1, notificationId: 'notification-id' }, 'Issue email accepted by GOV.UK Notify')
  expect(JSON.stringify([logger.info.mock.calls, logger.warn.mock.calls])).not.toMatch(/support@example.com|reporter@example.com|First line|evidence.png|private-key/)
})

test('identifies a failed submitter attempt and its retry delay without exposing SDK details', async () => {
  transport.mockResolvedValueOnce({ status: 201, data: { id: 'support-id' } })
    .mockRejectedValueOnce({ response: { status: 503, data: 'private response' } })
  await sendIssueEmail(report, rows, logger)
  expect(logger.warn).toHaveBeenCalledWith({ reference: report.id, recipientType: 'submitter', attempt: 1, statusCode: 503, retrying: true, retryDelayMs: 1000 }, 'Issue email request failed')
  expect(JSON.stringify(logger.warn.mock.calls)).not.toMatch(/private response|support@example.com|reporter@example.com/)
})
