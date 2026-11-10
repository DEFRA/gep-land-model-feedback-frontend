import { listDatasets } from './client.js'
import { config } from '#/config/config.js'

const { logger } = vi.hoisted(() => ({ logger: { error: vi.fn() } }))
vi.mock('../../helpers/logging/logger.js', () => ({
  createLogger: () => logger,
  logExternalCall: (_service, _operation, call) => call()
}))
const request = vi.fn()
let consoleError
const hit = { _id: 'dataset-1', _source: { resourceTitleObject: { default: 'Example dataset' } } }
const response = (hits = [hit], total = hits.length) => ({ status: 200, json: async () => ({ hits: { hits, total } }) })
const originalCategories = config.get('geonetwork.datasetCategories')
const originalKeywords = config.get('geonetwork.datasetKeywords')
afterEach(() => {
  consoleError.mockRestore()
  vi.unstubAllGlobals()
  config.set('geonetwork.datasetCategories', originalCategories)
  config.set('geonetwork.datasetKeywords', originalKeywords)
})
beforeEach(() => {
  logger.error.mockClear()
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  request.mockReset().mockResolvedValue(response())
  vi.stubGlobal('fetch', request)
  config.set('geonetwork.datasetCategories', [])
  config.set('geonetwork.datasetKeywords', [])
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
test('includes any exact keyword label without restricting categories', async () => {
  config.set('geonetwork.datasetKeywords', [' Protected sites ', '', 'Woodland', 'Protected sites'])
  await listDatasets()
  const body = JSON.parse(request.mock.calls[0][1].body)
  expect(body.query.bool.filter).toEqual([
    { term: { isTemplate: 'n' } },
    { terms: { 'tag.default': ['Protected sites', 'Woodland'] } }
  ])
})
test('ignores blank category and keyword entries', async () => {
  config.set('geonetwork.datasetCategories', ['', '  '])
  config.set('geonetwork.datasetKeywords', ['', '  '])
  await listDatasets()
  const body = JSON.parse(request.mock.calls[0][1].body)
  expect(body.query.bool.filter).toEqual([{ term: { isTemplate: 'n' } }])
})
test('requires both category and keyword filters on every page when both are configured', async () => {
  config.set('geonetwork.datasetCategories', ['datasets'])
  config.set('geonetwork.datasetKeywords', ['Protected sites'])
  request.mockResolvedValueOnce(response([hit], { value: 2, relation: 'eq' }))
  request.mockResolvedValueOnce(response([{ ...hit, _id: 'dataset-2' }], 2))
  expect(await listDatasets()).toHaveLength(2)
  expect(request.mock.calls.map(([, options]) => JSON.parse(options.body).from)).toEqual([0, 1])
  for (const [, options] of request.mock.calls) {
    expect(JSON.parse(options.body).query.bool.filter).toEqual([
      { term: { isTemplate: 'n' } },
      { terms: { 'cat.keyword': ['datasets'] } },
      { terms: { 'tag.default': ['Protected sites'] } }
    ])
  }
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

test('logs HTTP failures as structured diagnostics and a single console line', async () => {
  request.mockResolvedValueOnce({ status: 403 })
  await expect(listDatasets()).rejects.toThrow('returned 403')
  const details = { stage: 'request', from: 0, statusCode: 403, name: 'Error', durationMs: expect.any(Number) }
  expect(logger.error).toHaveBeenCalledWith({ geonetworkError: details }, 'GeoNetwork list datasets failed')
  expect(consoleError).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('GeoNetwork list datasets failed: '))
  expect(JSON.parse(consoleError.mock.calls[0][0].split('failed: ')[1])).toEqual(details)
})

test.each(['ENOTFOUND', 'ECONNREFUSED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN'])('logs network cause %s without exposing private details', async code => {
  const error = new TypeError('fetch failed https://user:secret@example.com', {
    cause: Object.assign(new Error('private certificate or URL'), { code })
  })
  request.mockRejectedValueOnce(error)
  await expect(listDatasets()).rejects.toBe(error)
  expect(logger.error.mock.calls[0][0].geonetworkError).toMatchObject({ name: 'TypeError', causeCode: code })
  expect(consoleError.mock.calls[0][0]).toContain(code)
  expect(JSON.stringify([logger.error.mock.calls, consoleError.mock.calls])).not.toMatch(/secret|private|example.com/)
})

test('identifies timeouts and JSON failures, including a successful HTTP status before parsing', async () => {
  request.mockRejectedValueOnce(new DOMException('private timeout message', 'TimeoutError'))
  await expect(listDatasets()).rejects.toThrow()
  expect(consoleError.mock.calls[0][0]).toContain('TimeoutError')
  request.mockResolvedValueOnce({ status: 200, json: async () => { throw new SyntaxError('private response') } })
  await expect(listDatasets()).rejects.toThrow()
  expect(logger.error.mock.calls[1][0].geonetworkError).toMatchObject({ stage: 'parse JSON', statusCode: 200, name: 'SyntaxError' })
  expect(JSON.stringify(consoleError.mock.calls)).not.toContain('private')
})
