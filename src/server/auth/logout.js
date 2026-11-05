import { clearUserSession } from '../common/helpers/auth/user-session.js'
import { config } from '../../config/config.js'

const logoutController = {
  handler: async (request, h) => {
    const userSession = request.auth.credentials
    if (!userSession) {
      return h.redirect('/')
    }

    await clearUserSession(request)

    try {
      const oidcConfig = await request.server.oidc.getConfig()
      const metadata = oidcConfig.serverMetadata()
      const endSessionEndpoint = metadata.end_session_endpoint

      if (!endSessionEndpoint) {
        return h.redirect('/')
      }

      const logoutUrl = new URL(endSessionEndpoint)
      logoutUrl.searchParams.set('post_logout_redirect_uri', config.get('appBaseUrl'))

      if (userSession.loginHint) {
        logoutUrl.searchParams.set('logout_hint', userSession.loginHint)
      }

      return h.redirect(logoutUrl.href)
    } catch (error) {
      request.logger.warn(error, 'Failed to resolve OIDC end_session_endpoint')
      return h.redirect('/')
    }
  }
}

export { logoutController }
