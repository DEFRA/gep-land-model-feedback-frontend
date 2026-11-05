import { createLogger, logExternalCall } from '../../common/helpers/logging/logger.js'
import { config } from '../../../config/config.js'
import { statusCodes } from '../../common/constants/status-codes.js'
import { fields, recordSourceIncludes, searchFields, searchSourceIncludes } from './fields.js'

const logger = createLogger()

export const MAX_RESULTS = 500

const RECORDS_ONLY = { term: { isTemplate: 'n' } }

// GeoNetwork catalogue categories (cat.keyword), not ISO topic categories (cl_topic).
function recordFilters () {
  const categories = [...new Set(config.get('geonetwork.datasetCategories')
    .map((category) => category.trim())
    .filter(Boolean))]
  return categories.length
    ? [RECORDS_ONLY, { terms: { 'cat.keyword': categories } }]
    : [RECORDS_ONLY]
}

/**
 * @typedef {object} SpatialResolution
 * @property {number[]} scaleDenominators The denominator in each 1:n scale, e.g. 250000 for 1:250,000.
 * @property {string[]} distances Distance values including their units, e.g. '2 m'.
 */

/**
 * Catalogue metadata, separate from the dataset's S3 files and style.
 *
 * @typedef {object} DatasetMetadata
 * @property {string} id
 * @property {string} title
 * @property {string} inspireTheme
 * @property {string} abstract
 * @property {string | null} owner
 * @property {string | null} accessLevel
 * @property {string | null} updateFrequency
 * @property {string[]} categories
 * @property {string[]} catalogueCategories
 * @property {string | null} updatedAt
 * @property {string | null} licence
 * @property {string[]} format
 * @property {string | null} coordinateReferenceSystem
 * @property {string[]} places
 * @property {SpatialResolution | null} resolution
 * @property {string | null} creationDate
 */

/** @typedef {Pick<DatasetMetadata, 'id' | 'title' | 'inspireTheme'>} DatasetSummary */
/** @typedef {{ _id: string, _source?: Record<string, any> }} SearchHit */
/** @typedef {{ hits: { hits: SearchHit[], total?: number | { value: number, relation?: string } } }} SearchResponse */

/**
 * @param {Record<string, unknown>} body
 * @returns {Promise<SearchResponse>}
 */
async function searchRecords (body) {
  const url = `${config.get('geonetwork.apiUrl').replace(/\/$/, '')}/search/records/_search`
  const response = await logExternalCall('GeoNetwork', 'search', () => fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000)
  }))

  if (response.status !== statusCodes.ok) {
    await response.body?.cancel()
    throw new Error(`GeoNetwork search returned ${response.status}`)
  }

  const result = await response.json()
  if (!Array.isArray(result?.hits?.hits)) {
    throw new Error('GeoNetwork search returned an invalid response')
  }
  return /** @type {SearchResponse} */ (result)
}

/**
 * @param {SearchHit} hit
 * @param {(field: import('./fields.js').Field) => boolean} include
 * @returns {Partial<DatasetMetadata>}
 */
function mapHit (hit, include) {
  const src = hit._source ?? {}
  const result = { id: hit._id }

  for (const [name, field] of Object.entries(fields)) {
    if (!include(field)) {
      continue
    }
    result[name] = field.hitAccessor(src)
  }

  return result
}

/** @param {SearchHit} hit */
function mapSearchHit (hit) {
  return /** @type {DatasetSummary} */ (mapHit(hit, (field) => Boolean(field.inSearchResult)))
}

/** @param {SearchHit} hit */
function mapRecordHit (hit) {
  return /** @type {DatasetMetadata} */ (mapHit(hit, () => true))
}

/**
 * Searches titles and abstracts, or lists datasets by title for an empty query.
 *
 * Returns one page of up to MAX_RESULTS records with the total number of matches.
 * Category restrictions apply to both browsing and text searches.
 *
 * @param {string} [q] Query string
 * @param {{ from?: number }} [options] Zero-based offset for pagination
 * @returns {Promise<{ results: DatasetSummary[], total: number }>}
 */
export async function queryDatasets (q = '', { from = 0 } = {}) {
  if (typeof q !== 'string' || !Number.isSafeInteger(from) || from < 0) {
    throw new TypeError('Use a string query and a non-negative integer offset')
  }
  q = q.trim()
  const result = await searchRecords({
    size: MAX_RESULTS,
    from,
    track_total_hits: true,
    _source: searchSourceIncludes,
    query: {
      bool: {
        filter: recordFilters(),
        must: q
          ? {
              multi_match: {
                query: q,
                type: 'bool_prefix',
                operator: 'and',
                fields: searchFields
              }
            }
          : { match_all: {} }
      }
    },
    sort: q ? [{ _score: 'desc' }] : [{ [fields.title.sort.field]: 'asc' }]
  })

  const total = typeof result.hits.total === 'number' ? result.hits.total : result.hits.total?.value
  if (!Number.isSafeInteger(total) || total < 0 ||
      (typeof result.hits.total === 'object' && result.hits.total.relation === 'gte')) {
    throw new Error('GeoNetwork search did not return an exact result total')
  }
  logger.debug({ resultCount: result.hits.hits.length, total }, 'Metadata search completed')

  return {
    results: result.hits.hits.map(mapSearchHit),
    total
  }
}

/**
 * Retrieves every matching page for a dataset selector; empty queries sort by title.
 * Errors propagate rather than presenting a partial list as complete.
 * @param {string} [q]
 * @returns {Promise<DatasetSummary[]>}
 */
export async function listDatasets (q = '') {
  const datasets = []
  const seen = new Set()
  let from = 0
  let total
  do {
    const page = await queryDatasets(q, { from })
    total = page.total
    if (page.results.length === 0 && from < total) {
      throw new Error('GeoNetwork search ended before all datasets were retrieved')
    }
    for (const dataset of page.results) {
      if (seen.has(dataset.id)) {
        throw new Error('GeoNetwork search returned overlapping dataset pages; retry the listing')
      }
      seen.add(dataset.id)
      datasets.push(dataset)
    }
    from += page.results.length
  } while (from < total)
  return datasets
}

/**
 * Looks up a catalogue record by UUID, returning null when it is not found.
 *
 * @param {string} id
 * @returns {Promise<DatasetMetadata | null>}
 */
export async function getDatasetMetadata (id) {
  const result = await searchRecords({
    size: 1,
    _source: recordSourceIncludes,
    query: { bool: { filter: [...recordFilters(), { ids: { values: [id] } }] } }
  })
  const hit = result.hits.hits[0]
  logger.debug({ found: Boolean(hit) }, 'Metadata record lookup completed')
  if (!hit) {
    return null
  }

  return mapRecordHit(hit)
}
