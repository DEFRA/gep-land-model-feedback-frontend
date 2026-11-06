vi.mock('#/server/common/services/geonetwork/client.js', () => ({ listDatasets: vi.fn(async () => []) }))
import { load } from 'cheerio'
import { mockAuthCredentials } from '#/server/common/test-helpers/auth.js'
import { createServer } from '#/server/server.js'

const question = 'What type of issue is being reported?'
const selectionError = 'Select what type of issue is being reported'
let server

beforeAll(async () => {
  server = await createServer()
  await server.initialize()
})
afterAll(async () => server.stop({ timeout: 0 }))

function cookieHeader (response) {
  return (response.headers['set-cookie'] ?? []).map((value) => value.split(';')[0]).join('; ')
}

async function submit (fields = {}) {
  const page = await server.inject({ url: '/', auth: mockAuthCredentials })
  const $ = load(page.payload)
  return server.inject({
    method: 'POST',
    url: '/',
    auth: mockAuthCredentials,
    headers: { cookie: cookieHeader(page) },
    payload: { crumb: $('form[action="/"] input[name="crumb"]').val(), ...fields }
  })
}

test('initial page renders GOV.UK radios, hints and Continue without errors or a default choice', async () => {
  const response = await server.inject({ url: '/', auth: mockAuthCredentials })
  const $ = load(response.payload)
  expect(response.statusCode).toBe(200)
  expect($('h1').text().trim()).toBe(question)
  expect($('title').text()).toContain(question)
  expect($('.govuk-radios input[name="issueType"]').map((_, element) => $(element).val()).get()).toEqual(['data', 'technical'])
  expect($('.govuk-radios__label').map((_, element) => $(element).text().trim()).get()).toEqual(['Data issue', 'Technical issue'])
  expect($('.govuk-radios__hint').map((_, element) => $(element).text().trim()).get()).toEqual([
    'For example, a feature showing incorrect land cover',
    'For example, a dataset download not working'
  ])
  expect($('input[name="issueType"]:checked')).toHaveLength(0)
  expect($('.govuk-error-summary, .govuk-form-group--error')).toHaveLength(0)
  expect($('form[action="/"]').attr('novalidate')).toBeDefined()
  expect($('form[action="/"] .govuk-button').text().trim()).toBe('Continue')
  expect($('form[action="/"] input[name="crumb"]').val()).toBeTruthy()
  expect($('main').hasClass('app-main-wrapper--hero')).toBe(false)
})

test.each([{}, { issueType: '' }, { issueType: 'unknown' }, { issueType: ['data', 'technical'] }])('invalid selection %j shows the supplied error summary and inline error', async (fields) => {
  const response = await submit(fields)
  const $ = load(response.payload)
  expect(response.statusCode).toBe(400)
  expect($('title').text().trim()).toMatch(/^Error: What type of issue/)
  expect($('.govuk-error-summary__title').text().trim()).toBe('There is a problem')
  expect($('.govuk-error-summary__list a').text()).toBe(selectionError)
  expect($('.govuk-error-summary__list a').attr('href')).toBe('#issue-type')
  expect($('#issue-type-error').text()).toContain(selectionError)
  expect($('.govuk-form-group--error')).toHaveLength(1)
  expect($('fieldset').attr('aria-describedby')).toContain('issue-type-error')
  expect($('#issue-type').attr('aria-describedby')).toBe('issue-type-item-hint')
  expect(response.request.yar.get('issueType')).toBeNull()
})

test.each([
  ['data', 'Which dataset is the issue within?', ['ATLAS Land Model', 'Other']],
  ['technical', 'What does the technical issue relate to?', ['ATLAS Map Viewer', 'ATLAS Data Search & Find', 'ATLAS Repository Integration', 'ATLAS data ingestion', 'ATLAS data export', 'Other']]
])('valid %s selection persists, leads to its prototype step and is restored on return', async (issueType, title, labels) => {
  const response = await submit({ issueType })
  expect(response.statusCode).toBe(303)
  expect(response.headers.location).toBe(`/report-issue/${issueType}`)
  expect(response.request.yar.get('issueType')).toBe(issueType)
  const cookie = cookieHeader(response)
  const next = await server.inject({ url: response.headers.location, auth: mockAuthCredentials, headers: { cookie } })
  const $ = load(next.payload)
  expect(next.statusCode).toBe(200)
  expect($('h1').text().trim()).toBe(title)
  expect($('.govuk-back-link').attr('href')).toBe('/')
  expect($('.govuk-radios__label').map((_, element) => $(element).text().trim()).get()).toEqual(labels)
  if (issueType === 'data') {
    expect($('input[type="radio"]:enabled')).toHaveLength(2)
    expect($('form .govuk-button').attr('disabled')).toBeUndefined()
  } else {
    expect($('input[type="radio"]:enabled')).toHaveLength(6)
    expect($('form .govuk-button').attr('disabled')).toBeUndefined()
    expect($('#conditional-technical-area-other').hasClass('govuk-radios__conditional--hidden')).toBe(true)
  }
  const back = await server.inject({ url: '/', auth: mockAuthCredentials, headers: { cookie } })
  const backPage = load(back.payload)
  expect(backPage('input[name="issueType"]:checked').val()).toBe(issueType)
  expect(backPage('.govuk-error-summary')).toHaveLength(0)
  const other = issueType === 'data' ? 'technical' : 'data'
  const wrongBranch = await server.inject({ url: `/report-issue/${other}`, auth: mockAuthCredentials, headers: { cookie } })
  expect(wrongBranch.statusCode).toBe(303)
  expect(wrongBranch.headers.location).toBe('/')
})

test.each(['data', 'technical'])('direct access to the %s branch returns to the initial page', async (type) => {
  const response = await server.inject({ url: `/report-issue/${type}`, auth: mockAuthCredentials })
  expect(response.statusCode).toBe(303)
  expect(response.headers.location).toBe('/')
})

test('POST requires a valid CSRF token and authentication', async () => {
  const response = await server.inject({ method: 'POST', url: '/', auth: mockAuthCredentials, payload: { issueType: 'data' } })
  expect(response.statusCode).toBe(403)
  expect(response.request.yar.get('issueType')).toBeNull()
  const anonymous = await server.inject({ method: 'POST', url: '/', payload: { issueType: 'data' } })
  expect(anonymous.statusCode).toBe(302)
  expect(anonymous.headers.location).toMatch(/^\/auth\/login/)
})
