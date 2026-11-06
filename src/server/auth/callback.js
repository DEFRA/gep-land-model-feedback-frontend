import { randomUUID } from 'node:crypto'

import Boom from '@hapi/boom'

import { createUserSession, clearUserSession } from '../common/helpers/auth/user-session.js'
import { getSafeRedirect } from '../common/helpers/get-safe-redirect.js'
import { redirectWithRefresh } from '../common/helpers/url/url-helpers.js'

const authCallbackController = {
  options: {
    auth: 'federated-oidc',
    response: {
      failAction: () => Boom.boomify(Boom.unauthorized())
    }
  },
  handler: async (request, h) => {
    let redirect = '/'
    if (request.auth.isAuthenticated) {
      const sessionId = randomUUID()
      await clearUserSession(request)
      request.yar.reset()

      request.logger.info('Creating user session')
      await createUserSession(request, sessionId)

      request.sessionCookie.set({ sessionId })
      request.logger.info('User logged in')

      if (request.auth.credentials.referrer) {
        redirect = getSafeRedirect(request.auth.credentials.referrer)
      }
    }

    request.logger.info('Login complete')
    return redirectWithRefresh(h, redirect)
  }
}

export { authCallbackController }
