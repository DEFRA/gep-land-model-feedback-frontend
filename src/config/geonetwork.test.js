import { vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

test('uses the same local GeoNetwork endpoint as the viewer and leaves categories unrestricted by default', async () => {
  vi.stubEnv('GEONETWORK_API_URL', undefined)
  vi.stubEnv('GEONETWORK_DATASET_CATEGORIES', undefined)
  vi.resetModules()
  const { config } = await import('./config.js')
  expect(config.get('geonetwork.apiUrl')).toBe('http://localhost:8080/geonetwork/srv/api')
  expect(config.get('geonetwork.datasetCategories')).toEqual([])
})

test.each(['', 'datasets', 'landModelGrids,landModelParcels'])('reads category list %j and the API URL from the environment', async (categories) => {
  vi.stubEnv('GEONETWORK_API_URL', 'https://catalogue.example.com/geonetwork/srv/api')
  vi.stubEnv('GEONETWORK_DATASET_CATEGORIES', categories)
  vi.resetModules()
  const { config } = await import('./config.js')
  expect(config.get('geonetwork.apiUrl')).toBe('https://catalogue.example.com/geonetwork/srv/api')
  expect(config.get('geonetwork.datasetCategories').filter(Boolean)).toEqual(categories ? categories.split(',') : [])
})
