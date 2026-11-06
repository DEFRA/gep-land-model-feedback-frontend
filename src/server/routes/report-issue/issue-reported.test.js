vi.mock('#/server/datasets/geonetwork/catalogue.js', () => ({ listDatasets: vi.fn(async () => []) }))
import { load } from 'cheerio'
import { createServer } from '#/server/server.js'
import { config } from '#/config/config.js'
import { mockAuthCredentials } from '#/server/common/test-helpers/auth.js'

let server
let cookies
const reviewPath = '/report-issue/check-your-answers'
const reportedPath = '/report-issue/issue-reported'
const originalMailbox = config.get('supportMailboxAddress')
beforeAll(async () => {
  server = await createServer()
  await server.initialize()
})
afterAll(async () => server.stop({ timeout: 0 }))
beforeEach(() => {
  cookies = new Map()
  config.set('supportMailboxAddress', 'atlas-support@example.com')
})
afterEach(() => config.set('supportMailboxAddress', originalMailbox))

async function visit (url, payload) {
  const response = await server.inject({
    url,
    method: payload === undefined ? 'GET' : 'POST',
    auth: mockAuthCredentials,
    headers: { cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; ') },
    payload
  })
  for (const cookie of response.headers['set-cookie'] ?? []) {
    const [name, ...value] = cookie.split(';')[0].split('=')
    cookies.set(name, value.join('='))
  }
  return response
}
async function submit (url, fields = {}) {
  const page = await visit(url)
  const crumb = load(page.payload)('input[name="crumb"]').val()
  return visit(url, { crumb, ...fields })
}
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
  const response = await submit(reviewPath, { reference: 'USER-SUPPLIED-REFERENCE' })
  expect(response.statusCode).toBe(303)
  expect(response.headers.location).toBe(reportedPath)
  const receipt = response.request.yar.get('reportedIssue')
  expect(receipt.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  expect(receipt.reference).toMatch(/^[0-9A-F]{12}$/)
  expect(receipt.reference).toBe(receipt.id.replaceAll('-', '').slice(0, 12).toUpperCase())
  expect(receipt.answers.issueType).toBe(issueType)
  expect(receipt.answers.description).toBe('Example issue description')
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
  await submit('/report-issue/description?returnTo=check-your-answers', { issueDescription: 'Changed description' })
  const existing = await visit(reportedPath)
  expect(existing.request.yar.get('reportedIssue').answers.description).toBe('Example issue description')
  const next = await submit(reviewPath)
  const updated = next.request.yar.get('reportedIssue')
  expect(updated.reference).not.toBe(receipt.reference)
  expect(updated.answers.description).toBe('Changed description')
})

test('uses the current configured mailbox and omits the email sentence when unset', async () => {
  await start('technical')
  await submit(reviewPath)
  config.set('supportMailboxAddress', 'another-support@example.com')
  expect(load((await visit(reportedPath)).payload)('a[href="mailto:another-support@example.com"]')).toHaveLength(1)
  config.set('supportMailboxAddress', null)
  const response = await visit(reportedPath)
  expect(response.statusCode).toBe(200)
  expect(load(response.payload)('a[href^="mailto:"]')).toHaveLength(0)
  expect(response.payload).not.toContain('We have sent a confirmation email')
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
