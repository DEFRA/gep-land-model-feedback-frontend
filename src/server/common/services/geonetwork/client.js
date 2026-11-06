import { logExternalCall } from '../../helpers/logging/logger.js'
import { config } from '#/config/config.js'

export const MAX_RESULTS = 500

/** List dataset IDs and names for the selector, including any configured category. */
export async function listDatasets () {
  const categories = [...new Set(config.get('geonetwork.datasetCategories').map(value => value.trim()).filter(Boolean))]
  const filter = [{ term: { isTemplate: 'n' } }]
  if (categories.length) filter.push({ terms: { 'cat.keyword': categories } })
  const url = `${config.get('geonetwork.apiUrl').replace(/\/$/, '')}/search/records/_search`
  const datasets = []
  const seen = new Set()
  let from = 0
  let total
  do {
    const response = await logExternalCall('GeoNetwork', 'list datasets', () => fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        size: MAX_RESULTS,
        from,
        track_total_hits: true,
        _source: ['resourceTitleObject.default'],
        query: { bool: { filter } },
        sort: [{ 'resourceTitleObject.default.keyword': 'asc' }, { _doc: 'asc' }]
      })
    }))
    if (response.status !== 200) {
      await response.body?.cancel()
      throw new Error(`GeoNetwork search returned ${response.status}`)
    }
    const result = await response.json()
    const hits = result?.hits?.hits
    total = typeof result?.hits?.total === 'number' ? result.hits.total : result?.hits?.total?.value
    if (!Array.isArray(hits) || !Number.isSafeInteger(total) || total < 0 || result.hits.total?.relation === 'gte') {
      throw new Error('GeoNetwork search returned an invalid response or inexact total')
    }
    if (!hits.length && from < total) throw new Error('GeoNetwork search ended before all datasets were retrieved')
    for (const hit of hits) {
      const id = hit._id
      const title = hit._source?.resourceTitleObject?.default
      if (typeof id !== 'string' || !id || typeof title !== 'string' || !title.trim()) {
        throw new Error('GeoNetwork returned a dataset without an ID or name')
      }
      if (seen.has(id)) throw new Error('GeoNetwork search returned overlapping dataset pages')
      seen.add(id)
      datasets.push({ id, title })
    }
    from += hits.length
  } while (from < total)
  return datasets
}
