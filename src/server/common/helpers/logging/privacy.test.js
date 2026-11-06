import Hapi from '@hapi/hapi'
import hapiPino from 'hapi-pino'
import { pino } from 'pino'

const settings = vi.hoisted(() => ({ format: 'ecs' }))
vi.mock('#/config/config.js', () => ({
  config: { get: key => ({ log: { enabled: true, level: 'debug', format: settings.format, redact: [] }, serviceName: 'privacy-test', serviceVersion: '1' })[key] }
}))

test.each(['ecs', 'pino-pretty'])('%s preserves selected OIDC diagnostics through the error hook', async format => {
  settings.format = format
  vi.resetModules()
  const { loggerOptions } = await import('./logger-options.js')
  const output = []
  const logger = pino({ ...loggerOptions, transport: undefined }, { write: line => output.push(line) })
  const oidcError = {
    name: 'ResponseBodyError',
    code: 'OAUTH_RESPONSE_BODY_ERROR',
    message: 'Token endpoint rejected the client',
    statusCode: 400,
    oauthError: 'invalid_client',
    oauthDescription: 'No matching federated credential',
    correlationId: 'correlation-id',
    traceId: 'trace-id'
  }

  logger.error({ oidcError }, 'OIDC post-login failed')

  const entry = JSON.parse(output[0])
  expect(entry.oidcError).toEqual(oidcError)
  expect(entry.message ?? entry.msg).toBe('OIDC post-login failed')
})

test.each(['ecs', 'pino-pretty'])('%s request logs omit credentials, form data and raw errors', async format => {
  settings.format = format
  vi.resetModules()
  const { loggerOptions } = await import('./logger-options.js')
  const output = []
  const server = Hapi.server()
  await server.register({
    plugin: hapiPino,
    options: { ...loggerOptions, transport: undefined, stream: { write: line => output.push(line) } }
  })
  server.route({
    method: 'POST',
    path: '/failure',
    options: { auth: false },
    handler (request) {
      const error = Object.assign(new Error('private-marker in SDK URL'), {
        config: { headers: { authorization: 'private-marker' } },
        cause: new Error('private-marker in nested cause')
      })
      request.log(['error'], error)
      request.server.log(['error'], error)
      throw error
    }
  })
  try {
    const response = await server.inject({
      method: 'POST',
      url: '/failure?code=private-marker',
      headers: { authorization: 'Bearer private-marker', cookie: 'credential=private-marker' },
      payload: { description: 'private-marker' }
    })
    expect(response.statusCode).toBe(500)
    const logs = output.join('')
    expect(logs).not.toContain('private-marker')
    expect(logs).toContain('Operation failed')
    expect(logs).toContain('500')
  } finally {
    await server.stop({ timeout: 0 })
  }
})
