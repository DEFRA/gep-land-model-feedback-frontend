import { sendIssueEmail } from '../issue-reported/email.js'
import { createJourneyClient } from '#/server/common/test-helpers/journey-client.js'
vi.mock('#/server/routes/report-issue/issue-reported/email.js', () => ({ sendIssueEmail: vi.fn(async () => ({ id: 'notify-id', submitterCopy: { id: 'copy-id', recipient: 'reporter@example.com' }, recipient: 'atlas-support@example.com' })) }))
import { load } from 'cheerio'
import { createServer } from '#/server/server.js'
import { listDatasets } from '#/server/common/services/geonetwork/client.js'
vi.mock('#/server/common/services/geonetwork/client.js', () => ({ listDatasets: vi.fn() }))

let server
let client
const path = '/report-issue/data'
const fixtures = [{ id: 'woodland-id', title: 'Ancient woodland' }, { id: 'flood-id', title: 'Flood risk areas' }]
beforeAll(async () => { server = await createServer(); await server.initialize() })
afterAll(async () => server.stop({ timeout: 0 }))
beforeEach(() => { client = createJourneyClient(server); listDatasets.mockReset().mockResolvedValue(fixtures) })
const visit = (...args) => client.visit(...args)
const submit = (...args) => client.submit(...args)

async function start () { await submit('/', { issueType: 'data' }); return visit(path) }

test('reveals a GOV.UK select populated with catalogue IDs and names', async () => {
  const response = await start()
  const $ = load(response.payload)
  expect(response.statusCode).toBe(200)
  expect($('#dataset-2').attr('data-aria-controls')).toBe('conditional-dataset-2')
  expect($('#conditional-dataset-2').hasClass('govuk-radios__conditional--hidden')).toBe(true)
  expect($('#dataset-other').hasClass('govuk-select')).toBe(true)
  expect($('#dataset-other option').map((_, el) => [[$(el).val(), $(el).text()]]).get()).toEqual([['', 'Select a dataset'], ['woodland-id', 'Ancient woodland'], ['flood-id', 'Flood risk areas']])
})

test.each([undefined, '', ['woodland-id', 'flood-id'], 'unknown-id'])('rejects missing, forged or unavailable dataset IDs: %j', async datasetOtherId => {
  await start()
  const response = await submit(path, { dataset: 'other', datasetOtherId })
  const $ = load(response.payload)
  expect(response.statusCode).toBe(400)
  expect($('.govuk-error-summary__list a').text()).toBe('Select a dataset')
  expect($('.govuk-error-summary__list a').attr('href')).toBe('#dataset-other')
  expect($('#dataset-other-error').text()).toContain('Select a dataset')
  expect($('#dataset-2').is(':checked')).toBe(true)
  expect($('#conditional-dataset-2').hasClass('govuk-radios__conditional--hidden')).toBe(false)
  expect(response.request.yar.get('datasetOtherId')).toBeNull()
})

test('uses the catalogue name, restores selection and routes Other through the generic location and description', async () => {
  await start()
  const selected = await submit(path, { dataset: 'other', datasetOtherId: 'woodland-id', datasetOtherTitle: 'Forged title' })
  expect(selected.statusCode).toBe(303)
  expect(selected.headers.location).toBe('/report-issue/description')
  expect(selected.request.yar.get('datasetOtherTitle')).toBe('Ancient woodland')
  const back = load((await visit(path)).payload)
  expect(back('#dataset-other').val()).toBe('woodland-id')
  const description = load((await visit('/report-issue/description')).payload)
  expect(description('h1').text()).toBe('Enter a description of the issue')
  expect(description('label[for="issue-where"]').text().trim()).toBe('Where is the issue?')
  expect(description('.govuk-back-link').attr('href')).toBe(path)
  const invalid = await submit('/report-issue/description', { issueDescription: 'The dataset is incorrect', issueWhere: '  ' })
  expect(invalid.statusCode).toBe(400)
  expect(load(invalid.payload)('.govuk-error-summary__list a').attr('href')).toBe('#issue-where')
  expect(load(invalid.payload)('#issue-description-error')).toHaveLength(0)
  const valid = await submit('/report-issue/description', { issueDescription: 'The dataset is incorrect', issueWhere: '  Near the village  ' })
  expect(valid.headers.location).toBe('/report-issue/evidence')
  const review = await visit('/report-issue/check-your-answers')
  const $ = load(review.payload)
  expect(review.statusCode).toBe(200)
  expect($('.govuk-summary-list__value').text()).toContain('Ancient woodland')
  expect($('.govuk-summary-list__value').text()).toContain('Near the village')
  expect($('.govuk-summary-list__key').text()).not.toContain('Incorrect attributes')
  const submitted = await submit('/report-issue/check-your-answers', {})
  expect(sendIssueEmail.mock.calls.at(-1)[0].answers).toMatchObject({ dataset: 'other', datasetOtherId: 'woodland-id', datasetOtherTitle: 'Ancient woodland', issueWhere: 'Near the village' })
  expect(sendIssueEmail.mock.calls.at(-1)[0].answers).not.toHaveProperty('attributes')
  expect(submitted.request.yar.get('reportedIssue')).not.toHaveProperty('answers')
})

test('changing back to Land Model clears the saved Other selection', async () => {
  await start()
  await submit(path, { dataset: 'other', datasetOtherId: 'woodland-id' })
  const result = await submit(path, { dataset: 'land-model', datasetOtherId: 'woodland-id' })
  expect(result.headers.location).toBe('/report-issue/data/location')
  expect(result.request.yar.get('datasetOtherId')).toBeNull()
  expect(result.request.yar.get('datasetOtherTitle')).toBeNull()
})

test('catalogue outages allow Land Model but show a retry message and block Other', async () => {
  await start()
  listDatasets.mockRejectedValue(new Error('Catalogue unavailable'))
  const page = await visit(path)
  expect(page.statusCode).toBe(200)
  expect(page.payload).toContain('Datasets could not be loaded')
  const blocked = await submit(path, { dataset: 'other', datasetOtherId: 'woodland-id' })
  expect(blocked.statusCode).toBe(503)
  expect(blocked.request.yar.get('dataset')).toBeNull()
  expect((await submit(path, { dataset: 'land-model' })).statusCode).toBe(303)
})

test('handles no matching datasets and escapes catalogue names', async () => {
  listDatasets.mockResolvedValue([])
  const empty = await start()
  expect(empty.payload).toContain('No datasets are available')
  expect((await submit(path, { dataset: 'other', datasetOtherId: 'woodland-id' })).statusCode).toBe(400)
  listDatasets.mockResolvedValue([{ id: 'safe', title: '<script>alert(1)</script>' }])
  const page = await visit(path)
  expect(page.payload).not.toContain('<script>alert(1)</script>')
  expect(load(page.payload)('#dataset-other option[value="safe"]').text()).toBe('<script>alert(1)</script>')
})

test('membership is checked again on POST if the catalogue changes after rendering', async () => {
  await start()
  const page = await visit(path)
  listDatasets.mockResolvedValue([])
  const result = await visit(path, { crumb: load(page.payload)('input[name="crumb"]').val(), dataset: 'other', datasetOtherId: 'woodland-id' })
  expect(result.statusCode).toBe(400)
})

test.each([undefined, '', '   '])('shows both location and description errors together for a blank location: %j', async issueWhere => {
  await start()
  await submit(path, { dataset: 'other', datasetOtherId: 'woodland-id' })
  const response = await submit('/report-issue/description', { issueWhere, issueDescription: '' })
  const $ = load(response.payload)
  expect(response.statusCode).toBe(400)
  expect($('.govuk-error-summary__list a').map((_, el) => $(el).attr('href')).get()).toEqual(['#issue-where', '#issue-description'])
  expect($('#issue-where-error').text()).toContain('Enter the location of the issue')
  expect($('#issue-where').attr('aria-describedby')).toContain('issue-where-error')
  expect($('#issue-description-error').text()).toContain('Enter a description of the issue')
  expect(response.request.yar.get('issueWhere')).toBeNull()
})

test('a missing location in an invalid POST does not redisplay an old saved location', async () => {
  await start()
  await submit(path, { dataset: 'other', datasetOtherId: 'woodland-id' })
  await submit('/report-issue/description', { issueWhere: 'Saved location', issueDescription: 'Saved description' })
  const response = await submit('/report-issue/description?returnTo=check-your-answers', { issueDescription: '' })
  const $ = load(response.payload)
  expect(response.statusCode).toBe(400)
  expect($('#issue-where').val()).toBe('')
  expect($('#issue-where-error').text()).toContain('Enter the location of the issue')
  expect($('form').attr('action')).toBe('/report-issue/description?returnTo=check-your-answers')
  expect(response.request.yar.get('issueWhere')).toBe('Saved location')
})
