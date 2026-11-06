import { createJourneyClient } from '#/server/common/test-helpers/journey-client.js'
vi.mock('#/server/common/services/uploader/client.js', async importOriginal => ({
  ...await importOriginal(),
  initiateUpload: vi.fn(async () => '11111111-1111-4111-8111-111111111111'),
  getUploadStatus: vi.fn(async () => ({ uploadStatus: 'initiated' }))
}))
vi.mock('#/server/common/services/geonetwork/client.js', () => ({ listDatasets: vi.fn(async () => []) }))
import { load } from 'cheerio'
import { createServer } from '#/server/server.js'

let server
let client
const descriptionPath = '/report-issue/description'
const evidencePath = '/report-issue/evidence'
beforeAll(async () => {
  server = await createServer()
  await server.initialize()
})
afterAll(async () => server.stop({ timeout: 0 }))
beforeEach(() => { client = createJourneyClient(server) })

const visit = (...args) => client.visit(...args)
const submit = (...args) => client.submit(...args)

async function start (issueType = 'technical') {
  await submit('/', { issueType })
  if (issueType === 'technical') {
    await submit('/report-issue/technical', { technicalArea: 'map-viewer' })
  } else {
    await submit('/report-issue/data', { dataset: 'land-model' })
    await submit('/report-issue/data/location', { locationType: 'grid', gridReference: 'SK1481' })
    await submit('/report-issue/data/attributes', { attributes: ['land-cover', 'soils'] })
  }
  return visit(descriptionPath)
}

test.each(['data', 'technical'])('%s description saves trimmed text and opens the shared improved upload component', async issueType => {
  const page = await start(issueType)
  expect(load(page.payload)('form .govuk-button').is(':disabled')).toBe(false)
  expect((await visit(evidencePath)).headers.location).toBe(descriptionPath)
  const response = await submit(descriptionPath, { issueDescription: '  The dataset download does not start.  ' })
  expect(response.statusCode).toBe(303)
  expect(response.headers.location).toBe(evidencePath)
  expect(response.request.yar.get('issueDescription')).toBe('The dataset download does not start.')
  const evidence = await visit(evidencePath)
  const $ = load(evidence.payload)
  expect(evidence.statusCode).toBe(200)
  expect($('h1').text().trim()).toBe('Add any evidence of the issue')
  expect($('label[for="evidence-files"]').text().trim()).toBe('Upload files')
  expect($('.govuk-file-upload-wrapper').attr('data-module')).toBe('govuk-file-upload')
  expect($('#evidence-files').is('input[type="file"].govuk-file-upload[multiple]')).toBe(true)
  expect($('#evidence-files').attr('required')).toBeUndefined()
  expect($('form[enctype="multipart/form-data"]').attr('action')).toMatch(/^http:\/\/localhost:7337\/upload-and-scan\//)
  expect($('form[enctype="multipart/form-data"] input[name="crumb"]')).toHaveLength(0)
  expect($('#evidence-files-hint').text()).toContain('100 MB')
  expect($('a.govuk-button').attr('href')).toBe('/report-issue/check-your-answers')
  expect($('.govuk-back-link').attr('href')).toBe(descriptionPath)
  const back = load((await visit(descriptionPath)).payload)
  expect(back('#issue-description').val()).toBe('The dataset download does not start.')
  expect(back('.govuk-back-link').attr('href')).toBe(issueType === 'data' ? '/report-issue/data/attributes' : '/report-issue/technical')
})

test.each([undefined, '', '  ', ['one', 'two'], { text: 'test' }].map(value => [value]))('requires description text: %j', async issueDescription => {
  await start()
  const response = await submit(descriptionPath, { issueDescription })
  const $ = load(response.payload)
  expect(response.statusCode).toBe(400)
  expect($('title').text().trim()).toMatch(/^Error:/)
  expect($('.govuk-error-summary__list a').text()).toBe('Enter a description of the issue')
  expect($('.govuk-error-summary__list a').attr('href')).toBe('#issue-description')
  expect($('#issue-description-error').text()).toContain('Enter a description of the issue')
  expect($('#issue-description').attr('aria-describedby')).toContain('issue-description-error')
  expect(response.request.yar.get('issueDescription')).toBeNull()
  expect((await visit(evidencePath)).headers.location).toBe(descriptionPath)
})

test('enforces the 2,000-character limit on the server and retains invalid text for correction', async () => {
  await start()
  const allowed = 'a'.repeat(2000)
  expect((await submit(descriptionPath, { issueDescription: allowed })).statusCode).toBe(303)
  const tooLong = `${allowed}a`
  const response = await submit(descriptionPath, { issueDescription: tooLong })
  const $ = load(response.payload)
  expect(response.statusCode).toBe(400)
  expect($('.govuk-error-summary__list a').text()).toBe('The description must be 2,000 characters or fewer')
  expect($('#issue-description-error').text()).toContain('The description must be 2,000 characters or fewer')
  expect($('#issue-description').val()).toBe(tooLong)
  expect(response.request.yar.get('issueDescription')).toBe(allowed)
})

test('escapes saved description text and replaces the previous description', async () => {
  await start()
  await submit(descriptionPath, { issueDescription: 'First description' })
  const value = '</textarea><script>alert(1)</script>'
  await submit(descriptionPath, { issueDescription: value })
  const response = await visit(descriptionPath)
  expect(response.payload).not.toContain('<script>alert(1)</script>')
  expect(load(response.payload)('#issue-description').val()).toBe(value)
})

test('guards description POSTs and evidence against skipped prerequisite steps', async () => {
  const home = await visit('/')
  const crumb = load(home.payload)('input[name="crumb"]').val()
  const check = async expected => {
    for (const fields of [{}, { issueDescription: 'Test description' }]) {
      expect((await visit(descriptionPath, { crumb, ...fields })).headers.location).toBe(expected)
    }
    expect((await visit(evidencePath)).headers.location).toBe(expected)
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
})

test('requires authentication and CSRF and does not expose an upload endpoint', async () => {
  await start()
  const response = await visit(descriptionPath, { issueDescription: 'Test description' })
  expect(response.statusCode).toBe(403)
  expect(response.request.yar.get('issueDescription')).toBeNull()
  for (const [url, method] of [[descriptionPath, 'POST'], [evidencePath, 'GET']]) {
    const anonymous = await server.inject({ url, method })
    expect(anonymous.statusCode).toBe(302)
    expect(anonymous.headers.location).toMatch(/^\/auth\/login/)
  }
  expect((await visit(evidencePath, {})).statusCode).toBe(404)
})
