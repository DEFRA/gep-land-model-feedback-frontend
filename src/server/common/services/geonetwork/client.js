import { logExternalCall } from '../../helpers/logging/logger.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { config } from '#/config/config.js'

export const MAX_RESULTS = 500
const REQUEST_TIMEOUT_MS = 10000

/** List dataset IDs and names for the selector, including any configured category. */
export async function listDatasets () {
  const categories = [...new Set(config.get('geonetwork.datasetCategories').map(value => value.trim()).filter(Boolean))]
  const filter = [{ term: { isTemplate: 'n' } }]
  if (categories.length) {
    filter.push({ terms: { 'cat.keyword': categories } })
  }
  const url = `${config.get('geonetwork.apiUrl').replace(/\/$/, '')}/search/records/_search`
  const datasets = []
  const seen = new Set()
  let from = 0
  let total
  do {
    // Pagination is sequential: the validated page determines the next offset.
    const page = await fetchDatasetPage(url, filter, from)
    total = page.total
    for (const hit of page.hits) {
      addDataset(hit, datasets, seen)
    }
    from += page.hits.length
  } while (from < total)
  return datasets
}

async function fetchDatasetPage (url, filter, from) {
  const response = await logExternalCall('GeoNetwork', 'list datasets', () => fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    body: JSON.stringify({
      size: MAX_RESULTS,
      from,
      track_total_hits: true,
      _source: ['resourceTitleObject.default'],
      query: { bool: { filter } },
      sort: [{ 'resourceTitleObject.default.keyword': 'asc' }, { _doc: 'asc' }]
    })
  }))
  if (response.status !== statusCodes.ok) {
    await response.body?.cancel()
    throw new Error(`GeoNetwork search returned ${response.status}`)
  }
  return parseDatasetPage(await response.json(), from)
}

function parseDatasetPage (result, from) {
  const resultHits = result?.hits ?? {}
  const hits = resultHits.hits
  const totalInfo = resultHits.total
  const total = typeof totalInfo === 'number' ? totalInfo : totalInfo?.value
  validatePageTotals(hits, total, totalInfo?.relation)
  if (!hits.length && from < total) {
    throw new Error('GeoNetwork search ended before all datasets were retrieved')
  }
  return { hits, total }
}

function validatePageTotals (hits, total, relation) {
  if (!Array.isArray(hits) || !Number.isSafeInteger(total) || total < 0 || relation === 'gte') {
    throw new Error('GeoNetwork search returned an invalid response or inexact total')
  }
}

function addDataset (hit, datasets, seen) {
  const id = hit._id
  const title = hit._source?.resourceTitleObject?.default
  if (typeof id !== 'string' || !id || typeof title !== 'string' || !title.trim()) {
    throw new Error('GeoNetwork returned a dataset without an ID or name')
  }
  if (seen.has(id)) {
    throw new Error('GeoNetwork search returned overlapping dataset pages')
  }
  seen.add(id)
  datasets.push({ id, title })
}
