import { load } from 'cheerio'
import { createServer } from '#/server/server.js'
import { mockAuthCredentials } from '#/server/common/test-helpers/auth.js'

let server
let cookies
const path = '/report-issue/technical'
const descriptionPath = '/report-issue/description'

beforeAll(async () => {
  server = await createServer()
  await server.initialize()
})
afterAll(async () => server.stop({ timeout: 0 }))
beforeEach(() => { cookies = new Map() })

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

function csrf (response, action) {
  return load(response.payload)(`form[action="${action}"] input[name="crumb"]`).val()
}

async function start (issueType = 'technical') {
  const initial = await visit('/')
  await visit('/', { issueType, crumb: csrf(initial, '/') })
  return visit(path)
}

async function submit (fields) {
  const page = await visit(path)
  return visit(path, { crumb: csrf(page, path), ...fields })
}

test('renders ATLAS radios and a GOV.UK conditional Other input with an enabled Continue button', async () => {
  const response = await start()
  const $ = load(response.payload)
  expect(response.statusCode).toBe(200)
  expect($('h1').text().trim()).toBe('What does the technical issue relate to?')
  expect($('form .govuk-button').attr('disabled')).toBeUndefined()
  expect($('input[type="radio"]:disabled')).toHaveLength(0)
  expect($('input[type="radio"]:checked')).toHaveLength(0)
  expect($('#technical-area-other').attr('data-aria-controls')).toBe('conditional-technical-area-other')
  expect($('#conditional-technical-area-other').hasClass('govuk-radios__conditional--hidden')).toBe(true)
  expect($('#technical-other').closest('.govuk-radios__conditional').attr('id')).toBe('conditional-technical-area-other')
  expect($('label[for="technical-other"]').text().trim()).toBe('Enter what the issue relates to')
  expect($('.govuk-back-link').attr('href')).toBe('/')
})

test.each([{}, { technicalArea: '' }, { technicalArea: 'invalid' }, { technicalArea: ['map-viewer', 'other'] }])('requires a valid radio selection: %j', async (payload) => {
  await start()
  const response = await submit(payload)
  const $ = load(response.payload)
  expect(response.statusCode).toBe(400)
  expect($('title').text().trim()).toMatch(/^Error:/)
  expect($('.govuk-error-summary__title').text().trim()).toBe('There is a problem')
  expect($('.govuk-error-summary__list a').text()).toBe('Select what the technical issue relates to')
  expect($('.govuk-error-summary__list a').attr('href')).toBe('#technical-area')
  expect($('#technical-area-error').text()).toContain('Select what the technical issue relates to')
  expect($('fieldset').attr('aria-describedby')).toContain('technical-area-error')
  expect(response.request.yar.get('technicalArea')).toBeNull()
})

test.each([undefined, '', '   ', ['one', 'two']])('requires Other text only when Other is selected: %j', async (technicalOther) => {
  await start()
  const response = await submit({ technicalArea: 'other', technicalOther })
  const $ = load(response.payload)
  expect(response.statusCode).toBe(400)
  expect($('#technical-area-other').is(':checked')).toBe(true)
  expect($('#conditional-technical-area-other').hasClass('govuk-radios__conditional--hidden')).toBe(false)
  expect($('.govuk-error-summary__list a').text()).toBe('Enter what the issue relates to')
  expect($('.govuk-error-summary__list a').attr('href')).toBe('#technical-other')
  expect($('#technical-other-error').text()).toContain('Enter what the issue relates to')
  expect($('#technical-other').attr('aria-describedby')).toContain('technical-other-error')
  expect(response.request.yar.get('technicalArea')).toBeNull()
})

test.each(['map-viewer', 'data-search', 'repository-integration', 'data-ingestion', 'data-export'])('persists %s and continues to description without requiring Other text', async (technicalArea) => {
  await start()
  const response = await submit({ technicalArea })
  expect(response.statusCode).toBe(303)
  expect(response.headers.location).toBe(descriptionPath)
  expect(response.request.yar.get('technicalArea')).toBe(technicalArea)
  expect(response.request.yar.get('technicalOther')).toBeNull()
  const description = await visit(descriptionPath)
  expect(description.statusCode).toBe(200)
  expect(load(description.payload)('h1').text().trim()).toBe('Enter a description of the issue')
  const back = load((await visit(path)).payload)
  expect(back('input[name="technicalArea"]:checked').val()).toBe(technicalArea)
})

test('trims and preserves Other text on return, then clears it when changing to a listed option', async () => {
  await start()
  const response = await submit({ technicalArea: 'other', technicalOther: '  A different service  ' })
  expect(response.statusCode).toBe(303)
  expect(response.request.yar.get('technicalOther')).toBe('A different service')
  const back = load((await visit(path)).payload)
  expect(back('#technical-area-other').is(':checked')).toBe(true)
  expect(back('#technical-other').val()).toBe('A different service')
  expect(back('#conditional-technical-area-other').hasClass('govuk-radios__conditional--hidden')).toBe(false)
  const changed = await submit({ technicalArea: 'map-viewer', technicalOther: 'A different service' })
  expect(changed.statusCode).toBe(303)
  expect(changed.request.yar.get('technicalOther')).toBeNull()
})

test('escapes Other text when displaying saved values', async () => {
  await start()
  const value = '"><script>alert(1)</script>'
  await submit({ technicalArea: 'other', technicalOther: value })
  const back = await visit(path)
  expect(back.payload).not.toContain('<script>alert(1)</script>')
  expect(load(back.payload)('#technical-other').val()).toBe(value)
})

test('description uses the GOV.UK character-count component, prototype hint and Back link', async () => {
  await start()
  await submit({ technicalArea: 'map-viewer' })
  const response = await visit(descriptionPath)
  const $ = load(response.payload)
  expect($('.govuk-character-count').attr('data-module')).toBe('govuk-character-count')
  expect($('.govuk-character-count').attr('data-maxlength')).toBe('2000')
  expect($('#issue-description').is('textarea.govuk-js-character-count')).toBe(true)
  expect($('#issue-description-hint').text().trim()).toBe('Enter as much information as possible to help us triage the issue. You will be able to attach files on the following page')
  expect($('.govuk-back-link').attr('href')).toBe(path)
  expect($('form .govuk-button').attr('disabled')).toBeUndefined()
})

test('prevents skipping workflow steps, including invalid or valid POSTs from the wrong branch', async () => {
  expect((await visit(path)).headers.location).toBe('/')
  expect((await visit(descriptionPath)).headers.location).toBe('/')
  await start('data')
  const initial = await visit('/')
  expect((await visit(path, { crumb: csrf(initial, '/'), technicalArea: 'map-viewer' })).headers.location).toBe('/')
  expect((await visit(path, { crumb: csrf(initial, '/') })).headers.location).toBe('/')
  await start()
  expect((await visit(descriptionPath)).headers.location).toBe(path)
})

test('keeps CSRF protection and authentication on technical submissions', async () => {
  await start()
  const forbidden = await visit(path, { technicalArea: 'map-viewer' })
  expect(forbidden.statusCode).toBe(403)
  expect(forbidden.request.yar.get('technicalArea')).toBeNull()
  const anonymous = await server.inject({ method: 'POST', url: path, payload: { technicalArea: 'map-viewer' } })
  expect(anonymous.statusCode).toBe(302)
  expect(anonymous.headers.location).toMatch(/^\/auth\/login/)
})

test('the previous technical description URL redirects to the shared page', async () => {
  await start()
  await submit({ technicalArea: 'map-viewer' })
  const response = await visit(`${path}/description`)
  expect(response.statusCode).toBe(303)
  expect(response.headers.location).toBe(descriptionPath)
})
