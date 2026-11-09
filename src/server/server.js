import path from 'node:path'
import hapi from '@hapi/hapi'
import Scooter from '@hapi/scooter'

import { router } from './plugins/router.js'
import { config } from '../config/config.js'
import { pulse } from './plugins/pulse.js'
import { catchAll } from './common/helpers/errors.js'
import { setupProxy } from './common/helpers/proxy/setup-proxy.js'
import { nunjucksConfig } from '../config/nunjucks/nunjucks.js'
import { requestTracing } from './plugins/request-tracing.js'
import { requestLogger } from './common/helpers/logging/request-logger.js'
import { sessionCache } from './plugins/session-cache.js'
import { getCacheEngine } from './common/helpers/session-cache/cache-engine.js'
import { secureContext } from '@defra/hapi-secure-context'
import { contentSecurityPolicy } from './plugins/content-security-policy.js'
import { securityHeaders } from './common/helpers/security-headers.js'
import { cookieConsent } from './plugins/cookie-consent.js'
import { csrf } from './common/helpers/csrf.js'
import { metrics } from '@defra/cdp-metrics'

import { setupCaches } from './common/helpers/session/setup-caches.js'
import { getUserSession } from './common/helpers/auth/decorators.js'
import { getLocalAuthBypassHost } from './common/helpers/auth/local-auth.js'
import { oidcClient } from './common/helpers/auth/oidc-client.js'
import { federatedOidc } from './common/helpers/auth/federated-oidc.js'
import { cognitoClientAssertion } from './common/helpers/auth/client-assertion/cognito.js'
import { mockClientAssertion } from './common/helpers/auth/client-assertion/mock.js'
import { sessionStrategy } from './common/helpers/auth/session-strategy.js'
import { setCacheHeaders } from './common/helpers/cache-headers.js'
import { validateProductionConfig } from './common/helpers/validate-production-config.js'

export async function createServer () {
  setupProxy()
  validateProductionConfig(config)
  const authRequired = config.get('auth.required')
  const localAuthBypassHost = getLocalAuthBypassHost()
  const server = hapi.server({
    host: localAuthBypassHost ?? config.get('host'),
    port: config.get('port'),
    routes: {
      auth: authRequired ? { mode: 'required' } : false,
      validate: {
        options: {
          abortEarly: false
        }
      },
      files: {
        relativeTo: path.resolve(config.get('root'), '.public')
      },
      security: {
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: false
        },
        // XSS Auditor is removed from modern browsers and can introduce
        // vulnerabilities when enabled. CSP provides modern XSS protection.
        // https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#x-xss-protection
        xss: 'disabled',
        noSniff: true,
        xframe: true,
        referrer: 'strict-origin-when-cross-origin'
      }
    },
    router: {
      stripTrailingSlash: true
    },
    cache: [
      {
        name: config.get('session.cache.name'),
        engine: getCacheEngine(config.get('session.cache.engine'))
      }
    ],
    state: {
      strictHeader: false
    }
  })
  setupCaches(server)
  server.decorate('request', 'getUserSession', getUserSession)

  await server.register([
    requestLogger,
    requestTracing,
    metrics,
    secureContext,
    pulse
  ])

  if (!authRequired) {
    server.logger.warn('Authentication is disabled (AUTH_REQUIRED=false); application routes are accessible without sign-in')
  }

  const credentialProvider = config.get('cognito.enabled')
    ? cognitoClientAssertion
    : mockClientAssertion

  await server.register([
    sessionCache,
    ...(authRequired ? [credentialProvider, oidcClient, federatedOidc, sessionStrategy] : []),
    nunjucksConfig,
    Scooter,
    contentSecurityPolicy,
    securityHeaders,
    csrf,
    cookieConsent,
    router // Register all the controllers/routes defined in src/server/plugins/router.js
  ])

  server.ext('onPreResponse', catchAll)
  server.ext('onPreResponse', setCacheHeaders)

  return server
}
