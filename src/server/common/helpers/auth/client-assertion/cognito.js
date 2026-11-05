import { createLogger, logExternalCall } from '../../logging/logger.js'
import jwt from '@hapi/jwt'
import {
  CognitoIdentityClient,
  GetOpenIdTokenForDeveloperIdentityCommand
} from '@aws-sdk/client-cognito-identity'
import { config } from '../../../../../config/config.js'

const logger = createLogger()

export class CognitoFederatedCredentialProvider {
  token = null

  constructor (poolId, serviceName) {
    this.poolId = poolId
    this.logins = {
      [`${serviceName}-aad-access`]: serviceName
    }
    this.client = new CognitoIdentityClient()
  }

  async requestCognitoToken () {
    const input = {
      IdentityPoolId: this.poolId,
      Logins: this.logins
    }
    try {
      const command = new GetOpenIdTokenForDeveloperIdentityCommand(input)
      const result = await logExternalCall('Cognito', 'GetOpenIdTokenForDeveloperIdentity', () => this.client.send(command))
      logger.info(`Got token from Cognito ${result?.IdentityId}`)
      return result.Token
    } catch (e) {
      logger.error(e, 'Failed to get Cognito Token')
      throw e
    }
  }

  async getToken () {
    if (!this.token || tokenHasExpired(this.token)) {
      logger.info('Refreshing cognito token')
      this.token = await this.requestCognitoToken()
    }
    return this.token
  }
}

export const cognitoClientAssertion = {
  plugin: {
    name: 'client-assertion',
    version: '1.0.0',
    register: (server) => {
      const poolId = config.get('cognito.identityPoolId')
      const serviceName = config.get('serviceName')
      const cognitoProvider = new CognitoFederatedCredentialProvider(poolId, serviceName)
      server.decorate('server', 'clientAssertion', cognitoProvider)
    }
  }
}

export function tokenHasExpired (token) {
  try {
    const decodedToken = jwt.token.decode(token)
    jwt.token.verifyTime(decodedToken)
  } catch (e) {
    logger.debug(e, 'Cognito token has expired')
    return true
  }
  return false
}
