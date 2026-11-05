import authCookie from '@hapi/cookie'
import { config } from '../../../../config/config.js'
import { refreshTokenIfExpired } from './user-session.js'

const sessionCookieConfig = config.get('session.cookie')

const sessionStrategy = {
  plugin: {
    name: 'session-strategy',
    register: async (server) => {
      await server.register(authCookie)

      server.auth.strategy('session', 'cookie', {
        cookie: {
          name: sessionCookieConfig.name,
          path: '/',
          password: sessionCookieConfig.password,
          isSecure: sessionCookieConfig.secure,
          ttl: sessionCookieConfig.ttl,
          clearInvalid: true
        },
        keepAlive: true,
        appendNext: true,
        redirectTo: (request) => {
          const accept = request.headers.accept ?? ''
          if (accept.includes('application/json')) {
            return null
          }
          const tags = request.route.settings.tags ?? []
          if (tags.includes('api')) {
            return null
          }
          return '/auth/login'
        },
        requestDecoratorName: 'sessionCookie',
        validate: async (request, session) => {
          const userSession = await request.getUserSession(session.sessionId)
          if (!userSession?.isAuthenticated) {
            return { isValid: false }
          }

          let credentials
          try {
            credentials = await refreshTokenIfExpired(
              (token) => request.server.oidc.refresh(token),
              request,
              userSession
            ) ?? userSession
          } catch (error) {
            request.logger.error(
              error,
              'User session token refresh failed during validation'
            )
            return { isValid: false }
          }

          return { isValid: true, credentials }
        }
      })

      server.auth.default('session')
    }
  }
}

export { sessionStrategy }
