import { createLogger, logExternalCall } from '../../helpers/logging/logger.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { config } from '#/config/config.js'

export const MAX_RESULTS = 500
const REQUEST_TIMEOUT_MS = 10000
const logger = createLogger()

/** List dataset IDs and names for the selector, applying configured categories and keywords. */
export async function listDatasets () {
  const startedAt = performance.now()
  const context = { stage: 'request' }
  try {
    return await loadDatasets(context)
  } catch (error) {
    // Match OIDC's console fallback for hosting pipelines that drop custom fields.
    // Raw messages, URLs and response bodies can contain credentials or catalogue data.
    const safeCode = value => typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(value) ? value : undefined
    const geonetworkError = {
      ...context,
      name: ['Error', 'TypeError', 'SyntaxError', 'TimeoutError', 'AbortError'].includes(error?.name) ? error.name : 'Error',
      code: safeCode(error?.code),
      causeCode: safeCode(error?.cause?.code),
      durationMs: Math.round(performance.now() - startedAt)
    }
    const message = 'GeoNetwork list datasets failed'
    logger.error({ geonetworkError }, message)
    console.error(`${message}: ${JSON.stringify(geonetworkError)}`)
    throw error
  }
}

async function loadDatasets (context) {
  const categories = [...new Set(config.get('geonetwork.datasetCategories').map(value => value.trim()).filter(Boolean))]
  const keywords = [...new Set(config.get('geonetwork.datasetKeywords').map(value => value.trim()).filter(Boolean))]
  const filter = [{ term: { isTemplate: 'n' } }]
  if (categories.length) {
    filter.push({ terms: { 'cat.keyword': categories } })
  }
  if (keywords.length) {
    // tag.default is already a keyword field in GeoNetwork's index mapping.
    filter.push({ terms: { 'tag.default': keywords } })
  }
  const url = `${config.get('geonetwork.apiUrl').replace(/\/$/, '')}/search/records/_search`
  const datasets = []
  const seen = new Set()
  let from = 0
  let total
  do {
    // Pagination is sequential: the validated page determines the next offset.
    const page = await fetchDatasetPage(url, filter, from, context)
    total = page.total
    context.stage = 'validate records'
    for (const hit of page.hits) {
      addDataset(hit, datasets, seen)
    }
    from += page.hits.length
  } while (from < total)
  return datasets
}

async function fetchDatasetPage (url, filter, from, context) {
  context.stage = 'request'
  context.from = from
  delete context.statusCode
  const payload = {
    size: MAX_RESULTS,
    from,
    track_total_hits: true,
    _source: ['resourceTitleObject.default'],
    query: { bool: { filter } },
    sort: [{ 'resourceTitleObject.default.keyword': 'asc' }, { _doc: 'asc' }]
  }
  logDatasetDebug({ from, payload }, 'GeoNetwork dataset search request')
  const response = await logExternalCall('GeoNetwork', 'list datasets', () => fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    body: JSON.stringify(payload)
  }))
  context.statusCode = response.status
  logDatasetDebug({ from, statusCode: response.status }, 'GeoNetwork dataset search status')
  if (response.status !== statusCodes.ok) {
    if (logger.isLevelEnabled('debug')) {
      try {
        const errorResponse = await response.json()
        logDatasetDebug({ from, statusCode: response.status, response: errorResponse }, 'GeoNetwork dataset search response')
      } catch {
        logDatasetDebug({ from, statusCode: response.status }, 'GeoNetwork dataset search response is not valid JSON')
      }
    }
    if (!response.bodyUsed) {
      await response.body?.cancel()
    }
    throw new Error(`GeoNetwork search returned ${response.status}`)
  }
  context.stage = 'parse JSON'
  const result = await response.json()
  logDatasetDebug({ from, statusCode: response.status, response: result }, 'GeoNetwork dataset search response')
  context.stage = 'validate response'
  return parseDatasetPage(result, from)
}

function logDatasetDebug (details, message) {
  if (!logger.isLevelEnabled('debug')) {
    return
  }
  // Keep diagnostics in the message too: hosting pipelines can drop custom fields.
  logger.debug(details, `${message}: ${JSON.stringify(details)}`)
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
