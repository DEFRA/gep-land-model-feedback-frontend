import { createLogger, logExternalCall } from '../logging/logger.js'
import * as openid from 'openid-client'

import { config } from '../../../../config/config.js'

const logger = createLogger()

const DISCOVERY_CACHE_TTL = 60 * 60 * 1000 // 1 hour

/**
 * @typedef {object} OidcClient
 * @property {() => Promise<import('openid-client').Configuration>} getConfig
 * @property {(token: string) => Promise<import('openid-client').TokenEndpointResponse>} refresh
 * @property {string} scope
 */

const oidcClient = {
  plugin: {
    name: 'oidc-client',
    dependencies: ['client-assertion'],
    register: (server) => {
      const discoveryUri = config.get('oidc.wellKnownConfigurationUrl')
      const clientId = config.get('oidc.clientId')
      const useCognito = config.get('cognito.enabled')
      const execute = useCognito ? undefined : [openid.allowInsecureRequests]

      const baseScope = 'openid profile email offline_access'
      const scope = useCognito
        ? `${baseScope} user.read`
        : baseScope

      let cachedMetadata = null
      let cachedAt = 0
      let inflight = null

      async function resolveMetadata (federatedToken) {
        if (cachedMetadata && Date.now() - cachedAt <= DISCOVERY_CACHE_TTL) {
          logger.debug('Using cached OIDC discovery metadata')
          return cachedMetadata
        }

        if (!inflight) {
          inflight = logExternalCall('OIDC', 'discovery', () => openid.discovery(
            new URL(discoveryUri),
            clientId,
            {},
            createClientAuth(federatedToken),
            execute ? { execute } : {}
          ))
        }

        try {
          const oidcConfig = await inflight
          cachedMetadata = oidcConfig.serverMetadata()
          cachedAt = Date.now()
          logger.debug('OIDC discovery metadata cached')
          return cachedMetadata
        } finally {
          inflight = null
        }
      }

      /**
       * @returns {Promise<import('openid-client').Configuration>}
       */
      async function getConfig () {
        const federatedToken = await server.clientAssertion.getToken()
        const metadata = await resolveMetadata(federatedToken)

        const oidcConfig = new openid.Configuration(
          metadata,
          clientId,
          {},
          createClientAuth(federatedToken)
        )

        if (execute) {
          for (const fn of execute) {
            fn(oidcConfig)
          }
        }

        return oidcConfig
      }

      /**
       * @param {string} token
       * @returns {Promise<import('openid-client').TokenEndpointResponse>}
       */
      async function refresh (token) {
        const oidcConfig = await getConfig()
        return logExternalCall('OIDC', 'refreshTokenGrant', () => openid.refreshTokenGrant(oidcConfig, token, { scope }))
      }

      server.decorate('server', 'oidc', { getConfig, refresh, scope })
    }
  }
}

/**
 * Implements openid-client's ClientAuth interface for federated JWT assertion.
 * Passes a pre-signed JWT as client_assertion (jwt-bearer) instead of client_secret.
 * @param {string} assertion
 * @returns {import('openid-client').ClientAuth}
 */
function createClientAuth (assertion) {
  return (_as, client, body) => {
    body.set('client_id', client.client_id)
    body.set(
      'client_assertion_type',
      'urn:ietf:params:oauth:client-assertion-type:jwt-bearer'
    )
    body.set('client_assertion', assertion)
  }
}

export { oidcClient }
