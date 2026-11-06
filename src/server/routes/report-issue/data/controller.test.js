vi.mock('#/server/datasets/geonetwork/catalogue.js', () => ({ listDatasets: vi.fn(async () => []) }))
import { load } from 'cheerio'
import { createServer } from '#/server/server.js'
import { mockAuthCredentials } from '#/server/common/test-helpers/auth.js'

let server
let cookies
const datasetPath = '/report-issue/data'
const locationPath = `${datasetPath}/location`
const attributesPath = `${datasetPath}/attributes`
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
async function start (selectDataset = true) {
  await submit('/', { issueType: 'data' })
  if (selectDataset) await submit(datasetPath, { dataset: 'land-model' })
  return visit(selectDataset ? locationPath : datasetPath)
}

test('enables ATLAS Land Model, enables Other and restores the dataset on Back', async () => {
  const $ = load((await start(false)).payload)
  expect($('#dataset').is(':disabled')).toBe(false)
  expect($('#dataset-2').is(':disabled')).toBe(false)
  expect($('button').is(':disabled')).toBe(false)
  const next = await submit(datasetPath, { dataset: 'land-model' })
  expect(next.statusCode).toBe(303)
  expect(next.headers.location).toBe(locationPath)
  expect(load((await visit(datasetPath)).payload)('#dataset').is(':checked')).toBe(true)
})

test.each([{}, { dataset: 'invalid' }, { dataset: ['land-model', 'other'] }])('rejects missing or unsupported dataset: %j', async fields => {
  await start(false)
  const response = await submit(datasetPath, fields)
  expect(response.statusCode).toBe(400)
  expect(load(response.payload)('.govuk-error-summary__list a').attr('href')).toBe('#dataset')
  expect(response.request.yar.get('dataset')).toBeNull()
})

test('renders prototype labels and hints using GOV.UK conditional radios', async () => {
  const $ = load((await start()).payload)
  expect($('h1').text().trim()).toBe('Enter the location of the issue')
  expect($('#location-type-hint').text()).toContain('Select how you’d like to identify the location of the issue')
  expect($('.govuk-radios__label').map((_, el) => $(el).text().trim()).get()).toEqual(['Grid cell', 'Feature', 'Other'])
  expect($('.govuk-radios__conditional--hidden')).toHaveLength(3)
  expect($('label[for="grid-reference"]').text().trim()).toBe('Land model grid cell reference (British National Grid)')
  expect($('#grid-reference-hint').text().trim()).toBe('For example, SK1481')
  expect($('label[for="feature-reference"]').text().trim()).toBe('Land model feature reference (OSID)')
  expect($('#feature-reference-hint').text()).toContain('1e2f9011-ece7-4068-80ec-27e837259cf8')
  expect($('label[for="location-description"]').text().trim()).toBe('Describe the location')
  expect($('.govuk-back-link').attr('href')).toBe(datasetPath)
})

test.each([{}, { locationType: '' }, { locationType: 'invalid' }, { locationType: ['grid', 'feature'] }])('requires a valid location type: %j', async fields => {
  await start()
  const response = await submit(locationPath, fields)
  const $ = load(response.payload)
  expect(response.statusCode).toBe(400)
  expect($('title').text().trim()).toMatch(/^Error:/)
  expect($('.govuk-error-summary__list a').text()).toBe('Select how you want to identify the location of the issue')
  expect($('.govuk-error-summary__list a').attr('href')).toBe('#location-type')
  expect($('#location-type-error').text()).toContain('Select how you want to identify the location of the issue')
  expect(response.request.yar.get('issueLocation')).toBeNull()
})

const cases = [
  ['grid', 'gridReference', 'grid-reference', 'SK1481'],
  ['feature', 'featureReference', 'feature-reference', '1e2f9011-ece7-4068-80ec-27e837259cf8'],
  ['other', 'locationDescription', 'location-description', 'Near the village centre']
]
for (const [locationType, name, id, value] of cases) {
  test.each([undefined, '', '   ', ['one', 'two']])(`${locationType} requires non-blank text: %j`, async input => {
    await start()
    const response = await submit(locationPath, { locationType, [name]: input })
    const $ = load(response.payload)
    expect(response.statusCode).toBe(400)
    expect($('.govuk-error-summary__list a').text()).toBe('Enter the location of the issue')
    expect($('.govuk-error-summary__list a').attr('href')).toBe(`#${id}`)
    expect($(`#${id}-error`).text()).toContain('Enter the location of the issue')
    expect($(`#${id}`).closest('.govuk-radios__conditional').hasClass('govuk-radios__conditional--hidden')).toBe(false)
    expect($('input[name="locationType"]:checked').val()).toBe(locationType)
  })
  test(`${locationType} saves trimmed text, discards inactive fields and restores it on Back`, async () => {
    await start()
    await submit(locationPath, { locationType: 'other', locationDescription: 'Previous answer' })
    const response = await submit(locationPath, { locationType, gridReference: 'stale', featureReference: 'stale', locationDescription: 'stale', [name]: `  ${value}  ` })
    expect(response.statusCode).toBe(303)
    expect(response.headers.location).toBe(attributesPath)
    expect(response.request.yar.get('issueLocation')).toEqual({ locationType, [name]: value })
    const next = await visit(attributesPath)
    expect(next.statusCode).toBe(200)
    expect(load(next.payload)('h1').text().trim()).toBe('Which attributes are incorrect?')
    expect(load(next.payload)('.govuk-back-link').attr('href')).toBe(locationPath)
    const back = load((await visit(locationPath)).payload)
    expect(back(`#${id}`).val()).toBe(value)
    expect(back('input[name="locationType"]:checked').val()).toBe(locationType)
  })
}

test('escapes saved location text', async () => {
  await start()
  const value = '"><script>alert(1)</script>'
  await submit(locationPath, { locationType: 'other', locationDescription: value })
  const response = await visit(locationPath)
  expect(response.payload).not.toContain('<script>alert(1)</script>')
  expect(load(response.payload)('#location-description').val()).toBe(value)
})

test('guards skipped steps and submissions from the wrong branch', async () => {
  for (const url of [datasetPath, locationPath, attributesPath]) {
    expect((await visit(url)).headers.location).toBe('/')
  }
  const home = await visit('/')
  const crumb = load(home.payload)('input[name="crumb"]').val()
  for (const [url, fields] of [[datasetPath, {}], [datasetPath, { dataset: 'land-model' }], [locationPath, {}], [locationPath, { locationType: 'grid', gridReference: 'SK1481' }]]) {
    expect((await visit(url, { crumb, ...fields })).headers.location).toBe('/')
  }
  await start(false)
  expect((await visit(locationPath)).headers.location).toBe(datasetPath)
  expect((await visit(attributesPath)).headers.location).toBe(datasetPath)
  expect((await visit(locationPath, { crumb, locationType: 'grid', gridReference: 'SK1481' })).headers.location).toBe(datasetPath)
  await submit(datasetPath, { dataset: 'land-model' })
  expect((await visit(attributesPath)).headers.location).toBe(locationPath)
})

test('retains authentication and CSRF protection', async () => {
  await start()
  for (const url of [datasetPath, locationPath, attributesPath]) {
    expect((await visit(url, {})).statusCode).toBe(403)
    const response = await server.inject({ method: 'POST', url, payload: {} })
    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toMatch(/^\/auth\/login/)
  }
})

async function startAttributes () {
  await start()
  await submit(locationPath, { locationType: 'grid', gridReference: 'SK1481' })
  return visit(attributesPath)
}

const attributeValues = ['land-cover', 'land-use', 'ownership', 'soils', 'protected-areas', 'hydrology', 'topography']
const attributeLabels = ['Land cover', 'Land use', 'Ownership', 'Soils', 'Protected areas', 'Hydrology', 'Topography']
const descriptionPath = '/report-issue/description'

test('attributes uses enabled GOV.UK checkboxes, prototype wording and a Continue form', async () => {
  const response = await startAttributes()
  const $ = load(response.payload)
  expect(response.statusCode).toBe(200)
  expect($('h1').text().trim()).toBe('Which attributes are incorrect?')
  expect($('#attributes-hint').text().trim()).toBe('Select all that apply')
  expect($('.govuk-checkboxes__label').map((_, el) => $(el).text().trim()).get()).toEqual(attributeLabels)
  expect($('input[type="checkbox"]:enabled')).toHaveLength(7)
  expect($('input[type="checkbox"]:checked')).toHaveLength(0)
  expect($('form').attr('action')).toBe(attributesPath)
  expect($('form .govuk-button').is(':disabled')).toBe(false)
  expect($('.govuk-inset-text')).toHaveLength(0)
  expect($('.govuk-back-link').attr('href')).toBe(locationPath)
})

test.each([undefined, '', [], 'invalid', ['land-cover', 'invalid'], ['land-cover', 'land-cover'], { value: 'land-cover' }].map(attributes => [attributes]))('rejects invalid attribute selections: %j', async attributes => {
  await startAttributes()
  const response = await submit(attributesPath, { attributes })
  const $ = load(response.payload)
  expect(response.statusCode).toBe(400)
  expect($('title').text().trim()).toMatch(/^Error:/)
  expect($('.govuk-error-summary__title').text().trim()).toBe('There is a problem')
  expect($('.govuk-error-summary__list a').text()).toBe('Select which attributes are incorrect')
  expect($('.govuk-error-summary__list a').attr('href')).toBe('#attributes')
  expect($('#attributes-error').text()).toContain('Select which attributes are incorrect')
  expect($('fieldset').attr('aria-describedby')).toContain('attributes-error')
  expect(response.request.yar.get('incorrectAttributes')).toBeNull()
  if (Array.isArray(attributes) && attributes.includes('land-cover')) {
    expect($('#attributes').is(':checked')).toBe(true)
  }
})

test.each([...attributeValues, attributeValues, ['land-cover', 'soils']].map(attributes => [attributes]))('saves attributes %j and opens the shared description page', async attributes => {
  await startAttributes()
  const response = await submit(attributesPath, { attributes })
  const selected = Array.isArray(attributes) ? attributes : [attributes]
  expect(response.statusCode).toBe(303)
  expect(response.headers.location).toBe(descriptionPath)
  expect(response.request.yar.get('incorrectAttributes')).toEqual(selected)
  const description = await visit(descriptionPath)
  const $ = load(description.payload)
  expect(description.statusCode).toBe(200)
  expect($('h1').text().trim()).toBe('Enter a description of the issue')
  expect($('.govuk-character-count').attr('data-module')).toBe('govuk-character-count')
  expect($('.govuk-character-count').attr('data-maxlength')).toBe('2000')
  expect($('.govuk-back-link').attr('href')).toBe(attributesPath)
  const back = load((await visit(attributesPath)).payload)
  expect(back('input[name="attributes"]:checked').map((_, el) => back(el).val()).get()).toEqual(attributeValues.filter(value => selected.includes(value)))
})

test('replacing attribute choices clears previous choices; invalid attempts do not replace saved answers', async () => {
  await startAttributes()
  await submit(attributesPath, { attributes: attributeValues })
  const updated = await submit(attributesPath, { attributes: 'soils' })
  expect(updated.request.yar.get('incorrectAttributes')).toEqual(['soils'])
  const invalid = await submit(attributesPath, {})
  expect(invalid.statusCode).toBe(400)
  expect(load(invalid.payload)('input:checked')).toHaveLength(0)
  expect(invalid.request.yar.get('incorrectAttributes')).toEqual(['soils'])
})

test('guards attributes GET and valid or invalid POSTs when earlier steps are incomplete', async () => {
  const home = await visit('/')
  const crumb = load(home.payload)('input[name="crumb"]').val()
  const check = async expected => {
    expect((await visit(attributesPath)).headers.location).toBe(expected)
    for (const fields of [{}, { attributes: 'land-cover' }]) {
      expect((await visit(attributesPath, { crumb, ...fields })).headers.location).toBe(expected)
    }
    expect((await visit(descriptionPath)).headers.location).toBe(expected)
  }
  await check('/')
  await start(false)
  await check(datasetPath)
  await submit(datasetPath, { dataset: 'land-model' })
  await check(locationPath)
  await submit(locationPath, { locationType: 'grid', gridReference: 'SK1481' })
  expect((await visit(descriptionPath)).headers.location).toBe(attributesPath)
})

test('switching to technical prevents saved data answers from bypassing its question', async () => {
  await startAttributes()
  await submit(attributesPath, { attributes: 'land-cover' })
  await submit('/', { issueType: 'technical' })
  expect((await visit(descriptionPath)).headers.location).toBe('/report-issue/technical')
  const home = await visit('/')
  const crumb = load(home.payload)('input[name="crumb"]').val()
  expect((await visit(attributesPath, { crumb, attributes: 'soils' })).headers.location).toBe('/')
})
