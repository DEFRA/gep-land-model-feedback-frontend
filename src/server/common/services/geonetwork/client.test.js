import { listDatasets } from './client.js'
import { config } from '#/config/config.js'

const request = vi.fn()
const hit = { _id: 'dataset-1', _source: { resourceTitleObject: { default: 'Example dataset' } } }
const response = (hits = [hit], total = hits.length) => ({ status: 200, json: async () => ({ hits: { hits, total } }) })
const originalCategories = config.get('geonetwork.datasetCategories')
afterEach(() => {
  vi.unstubAllGlobals()
  config.set('geonetwork.datasetCategories', originalCategories)
})
beforeEach(() => {
  request.mockReset().mockResolvedValue(response())
  vi.stubGlobal('fetch', request)
  config.set('geonetwork.datasetCategories', [])
})
test('requests only names and returns stable IDs and names', async () => {
  expect(await listDatasets()).toEqual([{ id: 'dataset-1', title: 'Example dataset' }])
  const body = JSON.parse(request.mock.calls[0][1].body)
  expect(body._source).toEqual(['resourceTitleObject.default'])
  expect(body.query.bool.filter).toEqual([{ term: { isTemplate: 'n' } }])
  expect(body.sort[0]).toEqual({ 'resourceTitleObject.default.keyword': 'asc' })
  expect(request.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
})
test('includes any matching category and never applies viewer category exclusions', async () => {
  config.set('geonetwork.datasetCategories', [' datasets ', '', 'reference', 'datasets'])
  await listDatasets()
  const body = JSON.parse(request.mock.calls[0][1].body)
  expect(body.query.bool.filter).toContainEqual({ terms: { 'cat.keyword': ['datasets', 'reference'] } })
  expect(body.query.bool.must_not).toBeUndefined()
})
test('retrieves every page using the same inclusion filter', async () => {
  config.set('geonetwork.datasetCategories', ['datasets'])
  request.mockResolvedValueOnce(response([hit], { value: 2, relation: 'eq' }))
  request.mockResolvedValueOnce(response([{ ...hit, _id: 'dataset-2' }], 2))
  expect(await listDatasets()).toHaveLength(2)
  expect(request.mock.calls.map(([, options]) => JSON.parse(options.body).from)).toEqual([0, 1])
  for (const [, options] of request.mock.calls) expect(JSON.parse(options.body).query.bool.filter).toContainEqual({ terms: { 'cat.keyword': ['datasets'] } })
})
test('returns an empty list for no matches', async () => {
  request.mockResolvedValueOnce(response([]))
  expect(await listDatasets()).toEqual([])
})
test('rejects failed requests and consumes the response', async () => {
  const cancel = vi.fn()
  request.mockResolvedValueOnce({ status: 503, body: { cancel } })
  await expect(listDatasets()).rejects.toThrow('returned 503')
  expect(cancel).toHaveBeenCalledOnce()
})
test.each([{}, { hits: { hits: null, total: 0 } }, { hits: { hits: [], total: { value: 1, relation: 'gte' } } }])('rejects malformed responses: %j', async data => {
  request.mockResolvedValueOnce({ status: 200, json: async () => data })
  await expect(listDatasets()).rejects.toThrow('invalid response')
})
test.each([{ _id: 'no-title' }, { _source: hit._source }])('rejects unusable catalogue records: %j', async invalid => {
  request.mockResolvedValueOnce(response([invalid]))
  await expect(listDatasets()).rejects.toThrow('without an ID or name')
})
test('rejects missing or overlapping pages rather than presenting a partial list', async () => {
  request.mockResolvedValueOnce(response([], 1))
  await expect(listDatasets()).rejects.toThrow('before all datasets')
  request.mockResolvedValue(response([hit], 2))
  await expect(listDatasets()).rejects.toThrow('overlapping')
})
test('propagates network and JSON failures', async () => {
  request.mockRejectedValueOnce(new Error('Network unavailable'))
  await expect(listDatasets()).rejects.toThrow('Network unavailable')
  request.mockResolvedValueOnce({ status: 200, json: async () => { throw new SyntaxError('Invalid JSON') } })
  await expect(listDatasets()).rejects.toThrow('Invalid JSON')
})
