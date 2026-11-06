import Boom from '@hapi/boom'
import * as _openid from 'openid-client'
import { config as _config } from '../../../../config/config.js'

import { federatedOidc } from './federated-oidc.js'
import { createLogger } from '../logging/logger.js'

vi.mock('openid-client')
const openid = vi.mocked(_openid)

const configValues = vi.hoisted(() => ({
  appBaseUrl: 'http://localhost:3000',
  log: { enabled: false, level: 'silent', format: 'pino-pretty', redact: [] },
  serviceName: 'test-service',
  serviceVersion: '1.0.0'
}))

vi.mock('../../../../config/config.js', () => ({
  config: {
    get: vi.fn((key) => configValues[key])
  }
}))
const config = vi.mocked(_config)

const mockServerMetadata = {
  supportsPKCE: () => true
}

const mockOidcConfig = {
  serverMetadata: () => mockServerMetadata
}

function createMockServer () {
  return {
    auth: {
      scheme: vi.fn(),
      strategy: vi.fn()
    },
    oidc: {
      scope: 'openid profile email offline_access'
    }
  }
}

function createMockRequest (query = {}) {
  return {
    query,
    url: new URL('http://localhost:3000/auth/callback'),
    server: {
      oidc: {
        getConfig: vi.fn().mockResolvedValue(mockOidcConfig)
      }
    },
    yar: {
      set: vi.fn(),
      get: vi.fn()
    },
    logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn() }
  }
}

function createMockH () {
  return {
    redirect: vi.fn().mockReturnValue({ takeover: vi.fn() }),
    authenticated: vi.fn()
  }
}

describe('#federatedOidc', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    config.get.mockImplementation((key) => configValues[key])
  })

  describe('register', () => {
    test('registers scheme and strategy', () => {
      const server = createMockServer()

      federatedOidc.plugin.register(server)

      expect(server.auth.scheme).toHaveBeenCalledWith(
        'federated-oidc',
        expect.any(Function)
      )
      expect(server.auth.strategy).toHaveBeenCalledWith(
        'federated-oidc',
        'federated-oidc',
        expect.objectContaining({
          redirectUri: 'http://localhost:3000/auth/callback',
          sessionName: 'oidc-auth',
          scope: 'openid profile email offline_access'
        })
      )
    })
  })

  describe('authenticate', () => {
    function getAuthenticate (server) {
      federatedOidc.plugin.register(server)
      const schemeFactory = server.auth.scheme.mock.calls[0][1]
      const options = server.auth.strategy.mock.calls[0][2]
      const { authenticate } = schemeFactory(server, options)
      return authenticate
    }

    test('returns 401 on OIDC error callback', async () => {
      const server = createMockServer()
      const authenticate = getAuthenticate(server)
      const request = createMockRequest({
        error: 'invalid_scope',
        error_description: 'scope not allowed'
      })
      const h = createMockH()

      const result = await authenticate(request, h)

      expect(Boom.isBoom(result)).toBe(true)
      expect(result.output.statusCode).toBe(401)
    })

    test('redirects to OIDC provider on preLogin', async () => {
      const server = createMockServer()
      const authenticate = getAuthenticate(server)
      const request = createMockRequest()
      const h = createMockH()
      const authUrl = new URL('http://localhost:8081/realms/defra-local/protocol/openid-connect/auth')

      openid.randomPKCECodeVerifier.mockReturnValue('test-verifier')
      openid.calculatePKCECodeChallenge.mockResolvedValue('test-challenge')
      openid.buildAuthorizationUrl.mockReturnValue(authUrl)

      await authenticate(request, h)

      expect(request.server.oidc.getConfig).toHaveBeenCalled()
      expect(h.redirect).toHaveBeenCalledWith(authUrl)
      expect(openid.buildAuthorizationUrl).toHaveBeenCalledWith(
        mockOidcConfig,
        expect.objectContaining({
          redirect_uri: 'http://localhost:3000/auth/callback',
          scope: 'openid profile email offline_access',
          code_challenge: 'test-challenge',
          code_challenge_method: 'S256'
        })
      )
    })

    test('stores PKCE verifier and referrer in session on preLogin', async () => {
      const server = createMockServer()
      const authenticate = getAuthenticate(server)
      const request = createMockRequest()
      const h = createMockH()

      openid.randomPKCECodeVerifier.mockReturnValue('test-verifier')
      openid.calculatePKCECodeChallenge.mockResolvedValue('test-challenge')
      openid.buildAuthorizationUrl.mockReturnValue(new URL('http://localhost:8081'))

      await authenticate(request, h)

      expect(request.yar.set).toHaveBeenCalledWith('oidc-auth', {
        codeVerifier: 'test-verifier',
        nonce: undefined,
        referrer: '/'
      })
    })

    test('returns credentials on postLogin', async () => {
      const server = createMockServer()
      const authenticate = getAuthenticate(server)
      const request = createMockRequest({ code: 'auth-code' })
      const h = createMockH()
      const mockClaims = /** @type {import('openid-client').IDToken} */ ({
        iss: 'http://localhost:8081/realms/defra-local',
        sub: 'user-oid',
        aud: 'test-client-id',
        iat: 1740700800,
        exp: 1740704400,
        oid: 'user-oid',
        name: 'Test User',
        email: 'test@defra.gov.uk'
      })

      request.yar.get.mockReturnValue({ codeVerifier: 'stored-verifier' })
      // @ts-expect-error The helper methods are provided by openid-client at runtime and mocked here.
      openid.authorizationCodeGrant.mockResolvedValue({
        token_type: 'bearer',
        expiresIn: () => 3600,
        claims: () => mockClaims,
        access_token: 'access-tok',
        refresh_token: 'refresh-tok',
        id_token: 'id-tok'
      })

      await authenticate(request, h)

      expect(h.authenticated).toHaveBeenCalledWith({
        credentials: {
          expiresIn: 3600,
          accessToken: 'access-tok',
          refreshToken: 'refresh-tok',
          idToken: 'id-tok',
          claims: mockClaims,
          referrer: undefined
        }
      })
    })

    test('returns 401 when token response missing expires_in', async () => {
      const server = createMockServer()
      const authenticate = getAuthenticate(server)
      const request = createMockRequest({ code: 'auth-code' })
      const h = createMockH()

      request.yar.get.mockReturnValue({ codeVerifier: 'stored-verifier' })
      // @ts-expect-error The helper methods are provided by openid-client at runtime and mocked here.
      openid.authorizationCodeGrant.mockResolvedValue({
        expiresIn: () => null,
        claims: () => ({}),
        access_token: 'access-tok',
        refresh_token: 'refresh-tok',
        id_token: 'id-tok'
      })

      const result = await authenticate(request, h)

      expect(Boom.isBoom(result)).toBe(true)
      expect(result.output.statusCode).toBe(401)
    })

    describe('return path', () => {
      async function storedReferrer (request) {
        const authenticate = getAuthenticate(createMockServer())
        openid.randomPKCECodeVerifier.mockReturnValue('test-verifier')
        openid.calculatePKCECodeChallenge.mockResolvedValue('test-challenge')
        openid.buildAuthorizationUrl.mockReturnValue(new URL('http://localhost:8081'))

        await authenticate(request, createMockH())
        return request.yar.set.mock.calls[0][1].referrer
      }

      test('uses next query param', async () => {
        const request = createMockRequest({ next: '/datasets/abc?tab=map' })

        expect(await storedReferrer(request)).toBe('/datasets/abc?tab=map')
      })

      test.each([
        'https://evil.example/datasets',
        '//evil.example/datasets',
        '/.//evil.example/datasets',
        '/auth/login',
        '/auth/callback'
      ])('ignores unsafe next %s', async (next) => {
        expect(await storedReferrer(createMockRequest({ next }))).toBe('/')
      })
    })

    test('returns 401 when postLogin token exchange fails', async () => {
      const server = createMockServer()
      const authenticate = getAuthenticate(server)
      const request = createMockRequest({ code: 'auth-code' })
      const h = createMockH()

      request.yar.get.mockReturnValue({ codeVerifier: 'stored-verifier' })
      openid.authorizationCodeGrant.mockRejectedValue(new Error('token exchange failed'))

      const result = await authenticate(request, h)

      expect(Boom.isBoom(result)).toBe(true)
      expect(result.output.statusCode).toBe(401)
    })

    test('logs OAuth diagnostics without copying tokens, headers or callback parameters', async () => {
      const authenticate = getAuthenticate(createMockServer())
      const request = createMockRequest({ code: 'private-authorization-code' })
      request.yar.get.mockReturnValue({ codeVerifier: 'private-verifier' })
      const error = Object.assign(new Error('Token endpoint rejected the client'), {
        name: 'ResponseBodyError',
        code: 'OAUTH_RESPONSE_BODY_ERROR',
        status: 400,
        error: 'invalid_client',
        error_description: 'AADSTS: No matching federated identity credential',
        cause: { correlation_id: 'correlation-id', trace_id: 'trace-id', access_token: 'private-token' },
        response: { headers: { authorization: 'private-header' }, status: 400 }
      })
      openid.authorizationCodeGrant.mockRejectedValue(error)
      const logError = vi.spyOn(createLogger(), 'error').mockImplementation(() => {})
      try {
        const result = await authenticate(request, createMockH())
        expect(result.output.statusCode).toBe(401)
        expect(logError).toHaveBeenCalledExactlyOnceWith({
          oidcError: {
            name: 'ResponseBodyError',
            message: 'Token endpoint rejected the client',
            code: 'OAUTH_RESPONSE_BODY_ERROR',
            statusCode: 400,
            oauthError: 'invalid_client',
            oauthDescription: 'AADSTS: No matching federated identity credential',
            causeCode: undefined,
            correlationId: 'correlation-id',
            traceId: 'trace-id'
          }
        }, 'OIDC post-login failed')
        expect(JSON.stringify(logError.mock.calls)).not.toContain('private-')
      } finally {
        logError.mockRestore()
      }
    })

    test.each([
      [{ code: 'ECONNRESET' }, undefined, undefined],
      [{ error: 'invalid_grant', error_description: 'Code expired' }, 'invalid_grant', 'Code expired']
    ])('logs nested failure details when top-level OAuth fields are absent: %j', async (cause, oauthError, oauthDescription) => {
      const authenticate = getAuthenticate(createMockServer())
      const request = createMockRequest({ code: 'auth-code' })
      request.yar.get.mockReturnValue({ codeVerifier: 'stored-verifier' })
      openid.authorizationCodeGrant.mockRejectedValue(Object.assign(new Error('Exchange failed'), {
        cause,
        response: { status: 502 }
      }))
      const logError = vi.spyOn(createLogger(), 'error').mockImplementation(() => {})
      try {
        await authenticate(request, createMockH())
        expect(logError).toHaveBeenCalledWith({
          oidcError: expect.objectContaining({ statusCode: 502, causeCode: cause.code, oauthError, oauthDescription })
        }, 'OIDC post-login failed')
      } finally {
        logError.mockRestore()
      }
    })

    test('returns 401 when preLogin fails', async () => {
      const server = createMockServer()
      const authenticate = getAuthenticate(server)
      const request = createMockRequest()
      const h = createMockH()

      openid.randomPKCECodeVerifier.mockImplementation(() => {
        throw new Error('PKCE generation failed')
      })

      const result = await authenticate(request, h)

      expect(Boom.isBoom(result)).toBe(true)
      expect(result.output.statusCode).toBe(401)
    })
  })
})
