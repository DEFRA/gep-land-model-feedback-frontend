vi.mock('#/server/common/helpers/upload.js', async importOriginal => ({
  ...await importOriginal(),
  initiateUpload: vi.fn(async () => '11111111-1111-4111-8111-111111111111'),
  getUploadStatus: vi.fn(async () => ({ uploadStatus: 'initiated' }))
}))
vi.mock('#/server/datasets/geonetwork/catalogue.js', () => ({ listDatasets: vi.fn(async () => []) }))
import { load } from 'cheerio'
import { createServer } from '#/server/server.js'
import { mockAuthCredentials } from '#/server/common/test-helpers/auth.js'

let server
let cookies
const reviewPath = '/report-issue/check-your-answers'
const changing = path => `${path}?returnTo=check-your-answers`
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
async function submit (url, fields) {
  const page = await visit(url)
  const crumb = load(page.payload)('input[name="crumb"]').val()
  return visit(url, { crumb, ...fields })
}
async function start (issueType = 'data', location = { locationType: 'grid', gridReference: 'SK1481' }) {
  await submit('/', { issueType })
  if (issueType === 'data') {
    await submit('/report-issue/data', { dataset: 'land-model' })
    await submit('/report-issue/data/location', location)
    await submit('/report-issue/data/attributes', { attributes: ['land-cover', 'soils'] })
  } else {
    await submit('/report-issue/technical', { technicalArea: 'map-viewer' })
  }
  await submit('/report-issue/description', { issueDescription: 'First line\nSecond line' })
  return visit(reviewPath)
}
function rows (response) {
  const $ = load(response.payload)
  return Object.fromEntries($('.govuk-summary-list__row').map((_, row) => [[
    $(row).find('.govuk-summary-list__key').text().trim(),
    $(row).find('.govuk-summary-list__value').html().trim()
  ]]).get())
}

test.each(['data', 'technical'])('%s review matches prototype rows with accessible Change links', async issueType => {
  const response = await start(issueType)
  const $ = load(response.payload)
  expect(response.statusCode).toBe(200)
  expect($('h1').text().trim()).toBe('Check your answers')
  expect(Object.keys(rows(response))).toEqual(issueType === 'data'
    ? ['Issue type', 'Location ID', 'Incorrect attributes', 'Description', 'Files']
    : ['Issue type', 'Relates to', 'Description', 'Files'])
  expect(rows(response)['Issue type']).toBe(issueType === 'data' ? 'Data issue' : 'Technical issue')
  expect(rows(response).Description).toBe('First line<br>Second line')
  expect(rows(response).Files).toBe('No files added')
  if (issueType === 'data') {
    expect(rows(response)['Location ID']).toBe('SK1481')
    expect(rows(response)['Incorrect attributes']).toBe('Land cover<br>Soils')
    expect(response.payload).not.toContain('Relates to')
  } else {
    expect(rows(response)['Relates to']).toBe('ATLAS Map Viewer')
    expect(response.payload).not.toContain('Incorrect attributes')
  }
  for (const label of Object.keys(rows(response))) {
    const action = $('.govuk-summary-list__row').filter((_, row) => $(row).find('.govuk-summary-list__key').text().trim() === label).find('a')
    expect(action.text()).toContain('Change')
    expect(action.find('.govuk-visually-hidden').text().trim()).toBe(label)
    expect(action.attr('href')).toContain('?returnTo=check-your-answers')
  }
  expect($('.govuk-back-link').attr('href')).toBe('/report-issue/evidence')
  expect($('.govuk-button').text().trim()).toBe('Submit')
  expect($('.govuk-button').is(':disabled')).toBe(false)
  expect($('form').attr('action')).toBe(reviewPath)
  expect($('form input[name="crumb"]').val()).toBeTruthy()
  const evidence = load((await visit('/report-issue/evidence')).payload)
  expect(evidence('a.govuk-button').attr('href')).toBe(reviewPath)
})

test.each([
  ['feature', 'featureReference', '1e2f9011-ece7-4068-80ec-27e837259cf8', 'Location ID'],
  ['other', 'locationDescription', 'Near the village centre', 'Location']
])('shows the saved %s location', async (locationType, name, value, label) => {
  const response = await start('data', { locationType, [name]: value })
  expect(rows(response)[label]).toBe(value)
})

test('shows and escapes the technical Other answer and multiline description', async () => {
  await start('technical')
  const value = '<script>alert(1)</script>'
  await submit('/report-issue/technical', { technicalArea: 'other', technicalOther: value })
  await submit('/report-issue/description', { issueDescription: `<img src=x onerror=alert(1)>\n${value}` })
  const response = await visit(reviewPath)
  expect(response.statusCode).toBe(200)
  expect(response.payload).not.toContain(value)
  expect(response.payload).not.toContain('<img src=x')
  const $ = load(response.payload)
  expect($('.govuk-summary-list__value').eq(1).text().trim()).toBe(value)
  expect(rows(response).Description).toContain('&lt;img')
  expect(rows(response).Description).toContain('<br>')
})

const changes = [
  ['data', '/', { issueType: 'data' }, 'Issue type', 'Data issue'],
  ['data', '/report-issue/data', { dataset: 'land-model' }, 'Issue type', 'Data issue'],
  ['data', '/report-issue/data/location', { locationType: 'other', locationDescription: 'Another location' }, 'Location', 'Another location'],
  ['data', '/report-issue/data/attributes', { attributes: 'land-management' }, 'Incorrect attributes', 'Land management'],
  ['data', '/report-issue/description', { issueDescription: 'Updated data description' }, 'Description', 'Updated data description'],
  ['technical', '/report-issue/technical', { technicalArea: 'data-search' }, 'Relates to', 'ATLAS Data Search &amp; Find'],
  ['technical', '/report-issue/description', { issueDescription: 'Updated technical description' }, 'Description', 'Updated technical description']
]
test.each(changes)('%s change at %s validates and returns directly to review', async (issueType, path, fields, key, expected) => {
  await start(issueType)
  const url = changing(path)
  const page = load((await visit(url)).payload)
  expect(page('form').attr('action')).toBe(url)
  expect(page('.govuk-back-link').attr('href')).toBe(reviewPath)
  const error = await submit(url, {})
  expect(error.statusCode).toBe(400)
  expect(load(error.payload)('form').attr('action')).toBe(url)
  const response = await submit(url, fields)
  expect(response.statusCode).toBe(303)
  expect(response.headers.location).toBe(reviewPath)
  expect(rows(await visit(reviewPath))[key]).toBe(expected)
})

test('Change Files returns to review without posting or persisting file contents', async () => {
  await start()
  const response = await visit(changing('/report-issue/evidence'))
  const $ = load(response.payload)
  expect($('.govuk-back-link').attr('href')).toBe(reviewPath)
  expect($('a.govuk-button').attr('href')).toBe(reviewPath)
  expect($('form[enctype="multipart/form-data"]')).toHaveLength(1)
  expect(rows(await visit(reviewPath)).Files).toBe('No files added')
})

test('changing issue type prompts for missing answers rather than showing incomplete or stale branch rows', async () => {
  await start('technical')
  await submit(changing('/'), { issueType: 'data' })
  expect((await visit(reviewPath)).headers.location).toBe('/report-issue/data')
  await submit('/report-issue/data', { dataset: 'land-model' })
  expect((await visit(reviewPath)).headers.location).toBe('/report-issue/data/location')
  await submit('/report-issue/data/location', { locationType: 'grid', gridReference: 'SK1481' })
  expect((await visit(reviewPath)).headers.location).toBe('/report-issue/data/attributes')
  await submit('/report-issue/data/attributes', { attributes: 'soils' })
  const response = await visit(reviewPath)
  expect(rows(response)['Incorrect attributes']).toBe('Soils')
  expect(Object.keys(rows(response))).not.toContain('Relates to')
})

test('review cannot be opened without the required answers', async () => {
  expect((await visit(reviewPath)).headers.location).toBe('/')
  await submit('/', { issueType: 'technical' })
  expect((await visit(reviewPath)).headers.location).toBe('/report-issue/technical')
  await submit('/report-issue/technical', { technicalArea: 'map-viewer' })
  expect((await visit(reviewPath)).headers.location).toBe('/report-issue/description')
})

test('ignores arbitrary return URLs and retains authentication and CSRF', async () => {
  await start('technical')
  const unsafe = '/report-issue/description?returnTo=https://example.com'
  expect(load((await visit(unsafe)).payload)('form').attr('action')).toBe('/report-issue/description')
  expect((await submit(unsafe, { issueDescription: 'Updated' })).headers.location).toBe('/report-issue/evidence')
  expect((await visit(changing('/report-issue/description'), { issueDescription: 'No CSRF token' })).statusCode).toBe(403)
  const anonymous = await server.inject({ url: reviewPath })
  expect(anonymous.statusCode).toBe(302)
  expect(anonymous.headers.location).toMatch(/^\/auth\/login/)
  expect((await visit(reviewPath, {})).statusCode).toBe(403)
})
