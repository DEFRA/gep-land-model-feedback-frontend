import { config } from '../../../config/config.js'

const assetPath = config.get('assetPath')
const CACHE_CONTROL = 'cache-control'
const NO_STORE = 'no-store, no-cache, must-revalidate'

export function setCacheHeaders (request, h) {
  const { response } = request

  if (request.path.startsWith(assetPath) || request.path === '/favicon.ico') {
    return h.continue
  }

  if (response.isBoom) {
    response.output.headers[CACHE_CONTROL] ??= NO_STORE
  } else {
    response.headers[CACHE_CONTROL] ??= NO_STORE
  }

  return h.continue
}
