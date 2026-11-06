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
  answers: { submitterEmail: 'reporter@example.com', files: [{ filename: 'evidence.png', s3Key: 'private-key' }, { filename: 'details.pdf' }] }
}
const rows = [{ label: 'Issue type', lines: ['Data issue'] }, { label: 'Description', lines: ['First line', 'Second line'] }, { label: 'Files', lines: ['evidence.png', 'details.pdf'] }]
const logger = { info: vi.fn(), warn: vi.fn() }
beforeEach(() => {
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

test('uses the Notify SDK to send the reference, exact answer text and explicit file placeholders', async () => {
  expect(await sendIssueEmail(report, rows, logger)).toEqual({ id: 'notification-id', recipient: 'support@example.com' })
  expect(axios.create).toHaveBeenCalledWith({ timeout: 10000 })
  expect(transport).toHaveBeenCalledOnce()
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
        answers: 'Issue type:\nData issue\n\nDescription:\nFirst line\nSecond line\n\nFiles:\nevidence.png\ndetails.pdf',
        file_downloads: 'evidence.png: Download link not yet available\ndetails.pdf: Download link not yet available'
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
  expect(transport).toHaveBeenCalledTimes(3)
  expect(delay.mock.calls).toEqual([[1000], [2000]])
  expect(transport.mock.calls.map(([options]) => options.data.reference)).toEqual([report.id, report.id, report.id])
  expect(transport.mock.calls.map(([options]) => options.data.personalisation.submitter_email)).toEqual(Array(3).fill('reporter@example.com'))
})

test.each(['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'EAI_AGAIN', 'ECONNREFUSED', 'ENOTFOUND', 'EPIPE', 'ERR_NETWORK'])('retries temporary network error %s', async code => {
  transport.mockRejectedValueOnce({ code })
  await sendIssueEmail(report, rows, logger)
  expect(transport).toHaveBeenCalledTimes(2)
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
  expect(transport).toHaveBeenCalledTimes(2)
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
  if (field === 'recipient') config.set('supportMailboxAddress', null)
  else config.set(`notify.${field}`, '')
  await expect(sendIssueEmail(report, rows, logger)).rejects.toThrow('not configured')
  expect(transport).not.toHaveBeenCalled()
})

test('rejects a response without a notification ID without pretending the email was accepted', async () => {
  transport.mockResolvedValue({ status: 201, data: {} })
  await expect(sendIssueEmail(report, rows, logger)).rejects.toThrow('could not be sent')
  expect(transport).toHaveBeenCalledOnce()
})
