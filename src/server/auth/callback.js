import { randomUUID } from 'node:crypto'

import Boom from '@hapi/boom'

import { createUserSession } from '../common/helpers/auth/user-session.js'
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

      request.logger.info('Creating user session')
      const userSession = await createUserSession(request, sessionId)

      request.sessionCookie.set({ sessionId })
      request.logger.info(
        `User logged in UserId: ${userSession.id} displayName: ${userSession.displayName}`
      )

      if (request.auth.credentials.referrer) {
        redirect = request.auth.credentials.referrer
      }
    }

    request.logger.info(`Login complete, redirecting user to ${redirect}`)
    return redirectWithRefresh(h, redirect)
  }
}

export { authCallbackController }
