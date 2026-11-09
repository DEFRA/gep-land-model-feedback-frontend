import { createJourneyClient } from '#/server/common/test-helpers/journey-client.js'
vi.mock('#/server/routes/report-issue/issue-reported/email.js', () => ({ sendIssueEmail: vi.fn(async () => ({ id: 'notify-id', submitterCopy: { id: 'copy-id', recipient: 'reporter@example.com' }, recipient: 'atlas-support@example.com' })) }))
vi.mock('#/server/common/services/geonetwork/client.js', () => ({ listDatasets: vi.fn(async () => []) }))
import { sendIssueEmail } from '#/server/routes/report-issue/issue-reported/email.js'
import { submitIssueController } from './controller.js'
import { load } from 'cheerio'
import { createServer } from '#/server/server.js'
import { config } from '#/config/config.js'
import { mockAuthCredentials } from '#/server/common/test-helpers/auth.js'

let server
let client
const reviewPath = '/report-issue/check-your-answers'
const reportedPath = '/report-issue/issue-reported'
const originalMailbox = config.get('supportMailboxAddress')
beforeAll(async () => {
  server = await createServer()
  await server.initialize()
})
afterAll(async () => server.stop({ timeout: 0 }))
beforeEach(() => {
  client = createJourneyClient(server)
  sendIssueEmail.mockReset().mockResolvedValue({ id: 'notify-id', submitterCopy: { id: 'copy-id', recipient: 'reporter@example.com' }, recipient: 'atlas-support@example.com' })
  config.set('supportMailboxAddress', 'atlas-support@example.com')
})
afterEach(() => config.set('supportMailboxAddress', originalMailbox))

const visit = (...args) => client.visit(...args)
const submit = (...args) => client.submit(...args)

async function start (issueType) {
  await submit('/', { issueType })
  if (issueType === 'data') {
    await submit('/report-issue/data', { dataset: 'land-model' })
    await submit('/report-issue/data/location', { locationType: 'grid', gridReference: 'SK1481' })
    await submit('/report-issue/data/attributes', { attributes: ['land-cover', 'soils'] })
  } else {
    await submit('/report-issue/technical', { technicalArea: 'map-viewer' })
  }
  await submit('/report-issue/description', { issueDescription: 'Example issue description' })
  return visit(reviewPath)
}

test.each(['data', 'technical'])('%s Submit creates a UUID receipt and displays the GOV.UK confirmation panel', async issueType => {
  const review = await start(issueType)
  const reviewPage = load(review.payload)
  expect(reviewPage('form').attr('method')).toBe('post')
  expect(reviewPage('button').is(':disabled')).toBe(false)
  const response = await submit(reviewPath, { reference: 'USER-SUPPLIED-REFERENCE', submitterEmail: 'forged@example.com' })
  expect(response.statusCode).toBe(303)
  expect(response.headers.location).toBe(reportedPath)
  const receipt = response.request.yar.get('reportedIssue')
  expect(receipt.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  expect(receipt.reference).toMatch(/^[0-9A-F]{12}$/)
  expect(receipt.reference).toBe(receipt.id.replaceAll('-', '').slice(0, 12).toUpperCase())
  expect(receipt.answers.issueType).toBe(issueType)
  expect(receipt.answers.description).toBe('Example issue description')
  expect(receipt.answers.submitterEmail).toBe(mockAuthCredentials.credentials.email)
  expect(sendIssueEmail.mock.calls[0][0].answers.submitterEmail).toBe(mockAuthCredentials.credentials.email)
  expect(receipt.answers).not.toHaveProperty(issueType === 'data' ? 'technicalArea' : 'location')
  const confirmation = await visit(reportedPath)
  const $ = load(confirmation.payload)
  expect(confirmation.statusCode).toBe(200)
  expect($('title').text()).toContain('Issue reported')
  expect($('.govuk-panel--confirmation h1').text().trim()).toBe('Issue reported')
  expect($('.govuk-panel__body').text()).toContain('Your reference number')
  expect($('.govuk-panel__body strong').text()).toBe(receipt.reference)
  expect($('h2').text()).toBe('What happens next')
  expect($('a[href="mailto:atlas-support@example.com"]').text()).toBe('atlas-support@example.com')
  expect($('a[href^="mailto:"]').closest('p').text()).toBe('We have sent a confirmation email to atlas-support@example.com.')
  expect($('h2').prev('p').text()).toBe('We have sent a confirmation email to atlas-support@example.com.')
  expect($('h2').next('p').text()).toBe('We’ve sent your case to be triaged. You will be notified of any updates.')
  expect($('.govuk-back-link')).toHaveLength(0)
})

test('refresh and repeated POST reuse the same reference; edits produce a new receipt without changing the old snapshot', async () => {
  await start('technical')
  const first = await submit(reviewPath)
  const receipt = first.request.yar.get('reportedIssue')
  const reload = await visit(reportedPath)
  expect(load(reload.payload)('.govuk-panel__body strong').text()).toBe(receipt.reference)
  expect(reload.request.yar.get('reportedIssue')).toEqual(receipt)
  expect((await submit(reviewPath)).request.yar.get('reportedIssue')).toEqual(receipt)
  expect(sendIssueEmail).toHaveBeenCalledOnce()
  await submit('/report-issue/description?returnTo=check-your-answers', { issueDescription: 'Changed description' })
  const existing = await visit(reportedPath)
  expect(existing.request.yar.get('reportedIssue').answers.description).toBe('Example issue description')
  const next = await submit(reviewPath)
  const updated = next.request.yar.get('reportedIssue')
  expect(updated.reference).not.toBe(receipt.reference)
  expect(updated.answers.description).toBe('Changed description')
})

test('confirmation retains the actual recipient even if configuration subsequently changes', async () => {
  await start('technical')
  await submit(reviewPath)
  config.set('supportMailboxAddress', 'another-support@example.com')
  expect(load((await visit(reportedPath)).payload)('a[href="mailto:atlas-support@example.com"]')).toHaveLength(1)
  config.set('supportMailboxAddress', null)
  expect(load((await visit(reportedPath)).payload)('a[href="mailto:atlas-support@example.com"]')).toHaveLength(1)
})

test('does not create a receipt by opening the confirmation URL or skipping earlier steps', async () => {
  const confirmation = await visit(reportedPath)
  expect(confirmation.statusCode).toBe(303)
  expect(confirmation.headers.location).toBe(reviewPath)
  expect(confirmation.request.yar.get('reportedIssue')).toBeNull()
  const check = async expected => {
    const home = await visit('/')
    const crumb = load(home.payload)('input[name="crumb"]').val()
    const response = await visit(reviewPath, { crumb })
    expect(response.statusCode).toBe(303)
    expect(response.headers.location).toBe(expected)
    expect(response.request.yar.get('reportedIssue')).toBeNull()
  }
  await check('/')
  await submit('/', { issueType: 'technical' })
  await check('/report-issue/technical')
  await submit('/', { issueType: 'data' })
  await check('/report-issue/data')
  await submit('/report-issue/data', { dataset: 'land-model' })
  await check('/report-issue/data/location')
  await submit('/report-issue/data/location', { locationType: 'grid', gridReference: 'SK1481' })
  await check('/report-issue/data/attributes')
  await submit('/report-issue/data/attributes', { attributes: 'soils' })
  await check('/report-issue/description')
})

test('failed email preserves the reference and answers, blocks confirmation and allows a successful retry', async () => {
  await start('technical')
  sendIssueEmail.mockRejectedValueOnce(new Error('Temporarily unavailable'))
  const failed = await submit(reviewPath)
  expect(failed.statusCode).toBe(503)
  const receipt = failed.request.yar.get('reportedIssue')
  expect(receipt.notification).toBeUndefined()
  expect(load(failed.payload)('h1').text()).toBe('There is a problem submitting your issue')
  expect(load(failed.payload)('form').attr('method')).toBe('post')
  expect(load(failed.payload)('input[name="crumb"]').val()).toBeTruthy()
  expect((await visit(reportedPath)).headers.location).toBe(reviewPath)
  const retry = await submit(reviewPath)
  expect(retry.headers.location).toBe(reportedPath)
  expect(retry.request.yar.get('reportedIssue')).toMatchObject({ id: receipt.id, reference: receipt.reference, answers: receipt.answers, notification: { id: 'notify-id' } })
  expect(sendIssueEmail).toHaveBeenCalledTimes(2)
})

test.each(['data', 'technical'])('email receives the same %s answers as Check your answers', async issueType => {
  const review = await start(issueType)
  const $ = load(review.payload)
  const expected = $('.govuk-summary-list__row').map((_, element) => [{
    label: $(element).find('.govuk-summary-list__key').text().trim(),
    lines: $(element).find('.govuk-summary-list__value').html().trim().split('<br>')
  }]).get()
  await submit(reviewPath)
  expect(sendIssueEmail.mock.calls[0][1].map(({ label, lines }) => ({ label, lines }))).toEqual(expected)
})

test('waits for Notify acceptance before redirecting to confirmation', async () => {
  await start('technical')
  let accept
  sendIssueEmail.mockImplementationOnce(() => new Promise(resolve => { accept = resolve }))
  const sending = submit(reviewPath)
  let finished = false
  sending.then(() => { finished = true })
  await vi.waitFor(() => expect(accept).toBeTypeOf('function'))
  expect(finished).toBe(false)
  accept({ id: 'accepted-id', submitterCopy: { id: 'copy-id' }, recipient: 'atlas-support@example.com' })
  expect((await sending).headers.location).toBe(reportedPath)
})

test('submission requires CSRF and authentication and confirmations stay within their session', async () => {
  await start('technical')
  const forbidden = await visit(reviewPath, {})
  expect(forbidden.statusCode).toBe(403)
  expect(forbidden.request.yar.get('reportedIssue')).toBeNull()
  await submit(reviewPath)
  const otherSession = await server.inject({ url: reportedPath, auth: mockAuthCredentials })
  expect(otherSession.headers.location).toBe(reviewPath)
  for (const [url, method] of [[reviewPath, 'POST'], [reportedPath, 'GET']]) {
    const anonymous = await server.inject({ url, method })
    expect(anonymous.statusCode).toBe(302)
    expect(anonymous.headers.location).toMatch(/^\/auth\/login/)
  }
})

test('persists support acceptance when the submitter copy fails and retries the incomplete submission', async () => {
  await start('technical')
  sendIssueEmail.mockImplementationOnce(async report => {
    report.notification = { id: 'support-id', recipient: 'atlas-support@example.com' }
    throw new Error('Submitter copy failed')
  })
  const failed = await submit(reviewPath)
  expect(failed.statusCode).toBe(503)
  expect(load(failed.payload)('h1').text()).toBe('There is a problem sending your confirmation email')
  expect(failed.payload).toContain('Your issue report has been sent to support')
  const receipt = failed.request.yar.get('reportedIssue')
  expect(receipt.notification).toEqual({ id: 'support-id', recipient: 'atlas-support@example.com' })
  expect((await visit(reportedPath)).headers.location).toBe(reviewPath)
  sendIssueEmail.mockImplementationOnce(async report => {
    expect(report).toMatchObject({ id: receipt.id, notification: { id: 'support-id' } })
    return { ...report.notification, submitterCopy: { id: 'copy-id' } }
  })
  const retry = await submit(reviewPath)
  expect(retry.headers.location).toBe(reportedPath)
  expect((await visit(reportedPath)).statusCode).toBe(200)
  await submit(reviewPath)
  expect(sendIssueEmail).toHaveBeenCalledTimes(2)
})

test('stores the report before sending and makes support acceptance available while the copy is pending', async () => {
  await start('technical')
  let acceptCopy
  sendIssueEmail.mockImplementationOnce(async (report, rows, logger, onAccepted) => {
    // A separate request must see the saved receipt before the first send.
    const beforeSend = (await visit(reportedPath)).request.yar.get('reportedIssue')
    expect(beforeSend.id).toBe(report.id)
    expect(beforeSend.notification).toBeUndefined()
    report.notification = { id: 'support-id', recipient: 'atlas-support@example.com' }
    await onAccepted()
    await new Promise(resolve => { acceptCopy = resolve })
    report.notification.submitterCopy = { id: 'copy-id' }
    await onAccepted()
    return report.notification
  })
  const sending = submit(reviewPath)
  await vi.waitFor(() => expect(acceptCopy).toBeTypeOf('function'))
  try {
    const pending = await visit(reportedPath)
    expect(pending.headers.location).toBe(reviewPath)
    expect(pending.request.yar.get('reportedIssue').notification).toEqual({ id: 'support-id', recipient: 'atlas-support@example.com' })
  } finally {
    acceptCopy()
  }
  expect((await sending).headers.location).toBe(reportedPath)
  expect((await visit(reportedPath)).statusCode).toBe(200)
})

test('does not send emails if the receipt cannot be saved and logs the safe failure stage', async () => {
  const review = await start('technical')
  const request = review.request
  const commit = vi.spyOn(request.yar, 'commit').mockRejectedValue(new Error('private Redis connection string'))
  const errorLog = vi.spyOn(request.logger, 'error')
  const response = { code: vi.fn().mockReturnThis() }
  const h = { view: vi.fn(() => response) }
  try {
    expect(await submitIssueController.handler(request, h)).toBe(response)
    expect(response.code).toHaveBeenCalledWith(503)
    expect(sendIssueEmail).not.toHaveBeenCalled()
    expect(errorLog).toHaveBeenCalledWith({ reference: expect.any(String), failureStage: 'session', supportEmailAccepted: false, submitterCopyAccepted: false }, 'Unable to complete issue submission')
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain('private Redis')
  } finally {
    commit.mockRestore()
    errorLog.mockRestore()
  }
})
