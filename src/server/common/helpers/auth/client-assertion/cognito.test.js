import jwt from '@hapi/jwt'
import { createLogger } from '../../logging/logger.js'
import {
  tokenHasExpired,
  CognitoFederatedCredentialProvider,
  cognitoClientAssertion
} from './cognito.js'

const mockSend = vi.fn()

vi.mock('@aws-sdk/client-cognito-identity', () => ({
  CognitoIdentityClient: class { send = mockSend },
  GetOpenIdTokenForDeveloperIdentityCommand: class { constructor (input) { Object.assign(this, input) } }
}))

vi.mock('../../../../../config/config.js', () => ({
  config: {
    get: vi.fn((key) => {
      const values = {
        'cognito.identityPoolId': 'eu-west-2:pool-id',
        serviceName: 'test-service',
        log: { enabled: false, level: 'info', format: 'pino-pretty', redact: [] }
      }
      return values[key]
    })
  }
}))

describe('#tokenHasExpired', () => {
  test('returns true for expired token', () => {
    const token = jwt.token.generate({ test: 'ok' }, 'test', { ttlSec: -1 })
    expect(tokenHasExpired(token)).toBe(true)
  })

  test('returns false for valid token', () => {
    const token = jwt.token.generate({ test: 'ok' }, 'test', { ttlSec: 10000 })
    expect(tokenHasExpired(token)).toBe(false)
  })
})

describe('#CognitoFederatedCredentialProvider', () => {
  let provider

  beforeEach(() => {
    mockSend.mockReset()
    provider = new CognitoFederatedCredentialProvider('pool-id', 'test-service')
  })

  test('requestCognitoToken returns token from AWS', async () => {
    mockSend.mockResolvedValue({
      Token: 'cognito-token',
      IdentityId: 'identity-1'
    })

    const token = await provider.requestCognitoToken()

    expect(token).toBe('cognito-token')
    expect(mockSend).toHaveBeenCalledWith({
      IdentityPoolId: 'pool-id',
      Logins: { 'test-service-aad-access': 'test-service' }
    })
  })

  test('requestCognitoToken throws on failure', async () => {
    const error = Object.assign(new Error('Not authorized for this identity pool'), {
      name: 'NotAuthorizedException',
      code: 'AccessDenied',
      $metadata: { httpStatusCode: 400, requestId: 'aws-request-id' },
      config: { headers: { authorization: 'private-token' } },
      Token: 'private-token'
    })
    mockSend.mockRejectedValue(error)
    const logError = vi.spyOn(createLogger(), 'error').mockImplementation(() => {})

    try {
      await expect(provider.requestCognitoToken()).rejects.toBe(error)
      expect(logError).toHaveBeenCalledWith({
        awsError: {
          name: 'NotAuthorizedException',
          message: 'Not authorized for this identity pool',
          code: 'AccessDenied',
          statusCode: 400,
          requestId: 'aws-request-id'
        }
      }, 'Failed to get Cognito Token')
      expect(JSON.stringify(logError.mock.calls)).not.toContain('private-token')
    } finally {
      logError.mockRestore()
    }
  })

  test('getToken fetches on first call', async () => {
    mockSend.mockResolvedValue({ Token: 'fresh-token', IdentityId: 'id-1' })

    const token = await provider.getToken()

    expect(token).toBe('fresh-token')
    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  test('getToken returns cached token when not expired', async () => {
    const validJwt = jwt.token.generate({ sub: 'test' }, 'secret', { ttlSec: 10000 })
    mockSend.mockResolvedValue({ Token: validJwt, IdentityId: 'id-1' })

    await provider.getToken()
    const token = await provider.getToken()

    expect(token).toBe(validJwt)
    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  test('getToken refreshes when token expired', async () => {
    const expiredJwt = jwt.token.generate({ sub: 'test' }, 'secret', { ttlSec: -1 })
    const freshJwt = jwt.token.generate({ sub: 'test' }, 'secret', { ttlSec: 10000 })

    mockSend
      .mockResolvedValueOnce({ Token: expiredJwt, IdentityId: 'id-1' })
      .mockResolvedValueOnce({ Token: freshJwt, IdentityId: 'id-1' })

    await provider.getToken()
    const token = await provider.getToken()

    expect(token).toBe(freshJwt)
    expect(mockSend).toHaveBeenCalledTimes(2)
  })
})

describe('#cognitoClientAssertion', () => {
  test('plugin name is client-assertion', () => {
    expect(cognitoClientAssertion.plugin.name).toBe('client-assertion')
  })

  test('decorates server with clientAssertion', () => {
    const server = { decorate: vi.fn() }

    cognitoClientAssertion.plugin.register(server)

    expect(server.decorate).toHaveBeenCalledWith(
      'server',
      'clientAssertion',
      expect.any(CognitoFederatedCredentialProvider)
    )
  })
})
