import Crumb from '@hapi/crumb'
import { config } from '../../../config/config.js'

export const csrf = {
  plugin: Crumb,
  options: {
    // Protect application forms. OIDC callbacks use the provider's PKCE flow.
    skip: (request) => request.path === config.get('assetPath') ||
      request.path.startsWith(`${config.get('assetPath')}/`) ||
      request.path === '/auth/callback',
    cookieOptions: {
      isSecure: config.get('isProduction')
    }
  }
}
