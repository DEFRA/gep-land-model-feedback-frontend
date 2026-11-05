import { getDatasetMetadata, queryDatasets, listDatasets } from './catalogue.js'
import { hit } from './test-helpers/peaty-soil-depth.js'

import { config } from '#/config/config.js'

const request = vi.fn()
afterEach(() => vi.unstubAllGlobals())

beforeEach(() => {
  request.mockReset()
  vi.stubGlobal('fetch', request)
  config.set('geonetwork.datasetCategories', [])
  request.mockResolvedValue({ status: 200, json: async () => ({ hits: { total: { value: 1 }, hits: [hit] } }) })
})

test('searches catalogue text by prefix with a result limit and returns summaries', async () => {
  const result = await queryDatasets('pea')
  const query = JSON.parse(request.mock.calls[0][1].body)

  expect(query).toMatchObject({
    size: 500,
    query: { bool: { filter: [{ term: { isTemplate: 'n' } }], must: { multi_match: { query: 'pea', type: 'bool_prefix', operator: 'and' } } } }
  })
  expect(result).toEqual({ results: [{ id: hit._id, title: hit._source.resourceTitleObject.default, inspireTheme: 'Soil' }], total: 1 })
  expect(request.mock.calls[0][0]).toMatch(/\/search\/records\/_search$/)
})

test('browses the catalogue without requiring a query', async () => {
  await queryDatasets('')
  expect(JSON.parse(request.mock.calls[0][1].body).query).toEqual({
    bool: { filter: [{ term: { isTemplate: 'n' } }], must: { match_all: {} } }
  })
})

test('looks up metadata records only, excluding templates', async () => {
  await getDatasetMetadata(hit._id)
  expect(JSON.parse(request.mock.calls[0][1].body).query).toEqual({ bool: { filter: [{ term: { isTemplate: 'n' } }, { ids: { values: [hit._id] } }] } })
})

test('maps the Elasticsearch record into dataset metadata', async () => {
  const result = await getDatasetMetadata(hit._id)

  expect(result).toEqual({
    id: hit._id,
    title: 'England Peat Map Peaty Soil Depth',
    inspireTheme: 'Soil',
    abstract: hit._source.resourceAbstractObject.default,
    owner: 'Natural England',
    accessLevel: 'Open data',
    updateFrequency: 'As needed',
    categories: ['Environment'],
    catalogueCategories: [],
    updatedAt: '2025-05-09',
    licence: 'Open Government Licence',
    format: [
      'Cloud Optimized GeoTIFF',
      'Proprietary format | ESRI File based Geodatabase (GDB)',
      'Open format | Shapefile (SHP)',
      'Open format | JavaScript Object Notation (GeoJSON)',
      'Open format | Keyhole Markup Language (KML)',
      'Open format | Comma Separated Values file (CSV)',
      'Open format | MS Excel (XLSX)',
      'Open format | GeoPackage (GPKG)'
    ],
    coordinateReferenceSystem: 'http://www.opengis.net/def/crs/EPSG/0/27700',
    places: ['England'],
    resolution: { scaleDenominators: [], distances: ['10 m'] },
    creationDate: '2025-05-06'
  })
})

test('maps the catalogue categories of the record', async () => {
  const categorisedHit = { ...hit, _source: { ...hit._source, cat: ['datasets', 'landModelGrids'] } }
  request.mockResolvedValue({ status: 200, json: async () => ({ hits: { total: { value: 1 }, hits: [categorisedHit] } }) })

  const result = await getDatasetMetadata(hit._id)

  expect(result.catalogueCategories).toEqual(['datasets', 'landModelGrids'])
  expect(JSON.parse(request.mock.calls[0][1].body)._source).toContain('cat')
})

test('returns null when the catalogue record is missing', async () => {
  request.mockResolvedValue({ status: 200, json: async () => ({ hits: { hits: [] } }) })
  expect(await getDatasetMetadata(hit._id)).toBeNull()
})

test('reports catalogue errors and consumes the error response', async () => {
  const dump = vi.fn()
  request.mockResolvedValue({ status: 503, body: { cancel: dump } })

  await expect(queryDatasets('')).rejects.toThrow('GeoNetwork search returned 503')
  expect(dump).toHaveBeenCalledOnce()
})

test.each(['', ' soil '])('applies any configured catalogue category to query %j without viewer exclusions', async (q) => {
  config.set('geonetwork.datasetCategories', [' landModelGrids ', 'landModelParcels', '', 'landModelGrids', ' '])
  await queryDatasets(q)
  const query = JSON.parse(request.mock.calls[0][1].body)
  expect(query.query.bool.filter).toEqual([
    { term: { isTemplate: 'n' } },
    { terms: { 'cat.keyword': ['landModelGrids', 'landModelParcels'] } }
  ])
  expect(query.query.bool.must_not).toBeUndefined()
  expect(query.track_total_hits).toBe(true)
  expect(query.sort).toEqual(q.trim() ? [{ _score: 'desc' }] : [{ 'resourceTitleObject.default.keyword': 'asc' }])
})

test('category values remain case sensitive and apply to record lookup too', async () => {
  config.set('geonetwork.datasetCategories', ['LandModelGrids'])
  await getDatasetMetadata(hit._id)
  expect(JSON.parse(request.mock.calls[0][1].body).query.bool.filter).toEqual([
    { term: { isTemplate: 'n' } },
    { terms: { 'cat.keyword': ['LandModelGrids'] } },
    { ids: { values: [hit._id] } }
  ])
})

test('uses the configured API base URL, JSON headers and a ten-second timeout', async () => {
  const original = config.get('geonetwork.apiUrl')
  const timeout = vi.spyOn(AbortSignal, 'timeout')
  try {
    config.set('geonetwork.apiUrl', 'https://catalogue.example.com/geonetwork/srv/api/')
    await queryDatasets()
    expect(request).toHaveBeenCalledWith('https://catalogue.example.com/geonetwork/srv/api/search/records/_search', expect.objectContaining({
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      signal: expect.any(AbortSignal)
    }))
    expect(timeout).toHaveBeenCalledWith(10000)
  } finally {
    timeout.mockRestore()
    config.set('geonetwork.apiUrl', original)
  }
})

test('an empty catalogue produces an empty list after one request', async () => {
  request.mockResolvedValue({ status: 200, json: async () => ({ hits: { hits: [], total: { value: 0 } } }) })
  expect(await listDatasets()).toEqual([])
  expect(request).toHaveBeenCalledOnce()
})

test('loads more than 500 datasets with category restrictions on every page', async () => {
  const firstPage = Array.from({ length: 500 }, (_, i) => ({ _id: `dataset-${i}`, _source: { resourceTitleObject: { default: `Dataset ${i}` } } }))
  config.set('geonetwork.datasetCategories', ['datasets'])
  request.mockResolvedValueOnce({ status: 200, json: async () => ({ hits: { hits: firstPage, total: { value: 501, relation: 'eq' } } }) })
  request.mockResolvedValueOnce({ status: 200, json: async () => ({ hits: { hits: [hit], total: { value: 501, relation: 'eq' } } }) })
  const results = await listDatasets()
  expect(results).toHaveLength(501)
  expect(results[500].id).toBe(hit._id)
  expect(request.mock.calls.map(([, options]) => JSON.parse(options.body).from)).toEqual([0, 500])
  for (const [, options] of request.mock.calls) {
    expect(JSON.parse(options.body).query.bool.filter).toContainEqual({ terms: { 'cat.keyword': ['datasets'] } })
  }
})

test('fails rather than returning a partial list if a later page fails', async () => {
  request.mockResolvedValueOnce({ status: 200, json: async () => ({ hits: { hits: [hit], total: { value: 2 } } }) })
  const cancel = vi.fn()
  request.mockResolvedValueOnce({ status: 503, body: { cancel } })
  await expect(listDatasets()).rejects.toThrow('GeoNetwork search returned 503')
  expect(cancel).toHaveBeenCalledOnce()
})

test('detects missing and overlapping pages rather than silently producing an incomplete selector', async () => {
  request.mockResolvedValueOnce({ status: 200, json: async () => ({ hits: { hits: [], total: { value: 1 } } }) })
  await expect(listDatasets()).rejects.toThrow('before all datasets were retrieved')
  request.mockResolvedValue({ status: 200, json: async () => ({ hits: { hits: [hit], total: { value: 2 } } }) })
  await expect(listDatasets()).rejects.toThrow('overlapping dataset pages')
})

test.each([{}, { hits: {} }, { hits: { hits: null } }])('rejects malformed search responses %j', async (response) => {
  request.mockResolvedValue({ status: 200, json: async () => response })
  await expect(queryDatasets()).rejects.toThrow('invalid response')
})

test.each([undefined, -1, { value: 1, relation: 'gte' }])('rejects missing, invalid or inexact totals %j', async (total) => {
  request.mockResolvedValue({ status: 200, json: async () => ({ hits: { hits: [], total } }) })
  await expect(queryDatasets()).rejects.toThrow('exact result total')
})

test('supports an integer total and missing optional metadata', async () => {
  request.mockResolvedValue({ status: 200, json: async () => ({ hits: { hits: [{ _id: 'minimal' }], total: 1 } }) })
  expect(await listDatasets()).toEqual([{ id: 'minimal', title: '', inspireTheme: 'Other datasets' }])
})

test.each([['query', -1], ['query', 1.5], [123, 0]])('rejects invalid query or offset before making a request', async (q, from) => {
  await expect(queryDatasets(q, { from })).rejects.toThrow(TypeError)
  expect(request).not.toHaveBeenCalled()
})

test.each([new Error('Network unavailable'), new DOMException('Timeout', 'TimeoutError'), new SyntaxError('Invalid JSON')])('propagates request and JSON failures without returning an empty list', async (error) => {
  request.mockRejectedValueOnce(error)
  await expect(listDatasets()).rejects.toBe(error)
  request.mockResolvedValueOnce({ status: 200, json: async () => { throw error } })
  await expect(listDatasets()).rejects.toBe(error)
})
