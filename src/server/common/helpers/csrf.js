import Crumb from '@hapi/crumb'
import { config } from '../../../config/config.js'

export const csrf = {
  plugin: Crumb,
  options: {
    // Generate tokens on pages with the banner; validate only cookie preference POSTs.
    skip: (request) => request.path.startsWith(config.get('assetPath')) ||
      (request.method !== 'get' && request.path !== '/cookies'),
    cookieOptions: {
      isSecure: config.get('isProduction')
    }
  }
}
