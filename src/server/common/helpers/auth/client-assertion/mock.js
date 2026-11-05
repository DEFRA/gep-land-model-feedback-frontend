import { randomUUID } from 'node:crypto'

import jwt from '@hapi/jwt'

import { config } from '../../../../../config/config.js'
import { createLogger } from '../../logging/logger.js'

const logger = createLogger()

class MockCredentialProvider {
  constructor (clientId, clientSecret, audience) {
    this.clientId = clientId
    this.clientSecret = clientSecret
    this.audience = audience
  }

  async getToken () {
    return jwt.token.generate(
      {
        iss: this.clientId,
        sub: this.clientId,
        aud: this.audience,
        jti: randomUUID()
      },
      { key: this.clientSecret, algorithm: 'HS256' },
      { ttlSec: 300 }
    )
  }
}

export const mockClientAssertion = {
  plugin: {
    name: 'client-assertion',
    version: '1.0.0',
    register: (server) => {
      logger.warn(
        'Using MOCK credential provider! This should NOT be used in real environments!'
      )
      const clientId = config.get('oidc.clientId')
      const clientSecret = config.get('oidc.clientSecret')
      const wellKnownUrl = config.get('oidc.wellKnownConfigurationUrl')
      const audience = wellKnownUrl.replace(
        '/.well-known/openid-configuration',
        ''
      )

      const provider = new MockCredentialProvider(
        clientId,
        clientSecret,
        audience
      )
      server.decorate('server', 'clientAssertion', provider)
    }
  }
}
