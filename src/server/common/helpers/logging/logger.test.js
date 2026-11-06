import { createLogger, logExternalCall } from './logger.js'
import { loggerOptions } from './logger-options.js'
import { pino } from 'pino'

const logger = vi.hoisted(() => ({ info: vi.fn(), debug: vi.fn() }))
vi.mock('pino', () => ({ pino: vi.fn(() => logger) }))
vi.mock('./logger-options.js', () => ({ loggerOptions: { level: 'debug' } }))

afterEach(() => vi.unstubAllGlobals())

describe('external API logging', () => {
  test('uses the existing configured Pino logger', async () => {
    vi.resetModules()
    await import('./logger.js')
    expect(pino).toHaveBeenCalledWith(loggerOptions)
    expect(createLogger()).toBe(logger)
  })

  test.each([{ status: 503 }, { status: 404 }, { statusCode: 200 }, { $metadata: { httpStatusCode: 206 } }])('preserves responses and records status', async (response) => {
    const result = await logExternalCall('test', 'read', async () => response)
    expect(result).toBe(response)
    expect(logger.debug).toHaveBeenCalledWith({ service: 'test', operation: 'read' }, 'External API call started')
    const statusCode = response.status ?? response.statusCode ?? response.$metadata?.httpStatusCode
    const summary = { service: 'test', operation: 'read', durationMs: expect.any(Number), statusCode, outcome: statusCode >= 400 ? 'failure' : 'success' }
    expect(logger.debug).toHaveBeenCalledWith(summary, 'External API call completed')
    expect(logger.info).toHaveBeenCalledExactlyOnceWith(summary, statusCode >= 400 ? 'External API call failed' : 'External API call completed')
  })

  test('measures elapsed time using the monotonic clock', async () => {
    const now = vi.spyOn(performance, 'now').mockReturnValueOnce(100).mockReturnValueOnce(125)
    try {
      await logExternalCall('test', 'request', async () => undefined)
      expect(logger.debug).toHaveBeenLastCalledWith({
        service: 'test', operation: 'request', durationMs: 25, statusCode: undefined, outcome: 'success'
      }, 'External API call completed')
    } finally {
      now.mockRestore()
    }
  })

  test('preserves errors without logging potentially sensitive error details', async () => {
    const error = new Error('https://example.com/?key=secret')
    await expect(logExternalCall('test', 'read', async () => { throw error })).rejects.toBe(error)
    const summary = { service: 'test', operation: 'read', durationMs: expect.any(Number), statusCode: undefined, outcome: 'failure' }
    expect(logger.debug).toHaveBeenCalledWith(summary, 'External API call failed')
    expect(logger.info).toHaveBeenCalledExactlyOnceWith(summary, 'External API call failed')
    expect(JSON.stringify([logger.info.mock.calls, logger.debug.mock.calls])).not.toContain('secret')
  })

  test.each([
    [{ response: { status: 429, data: 'private response' } }, 429],
    [{ response: { statusCode: 502 } }, 502],
    [{ $metadata: { httpStatusCode: 503 } }, 503],
    [{ status: 401 }, 401],
    [{ statusCode: 504 }, 504],
    [{ cause: { status: 400 } }, 400],
    [null, undefined],
    [undefined, undefined]
  ])('records safe SDK error status and preserves the original rejection: %j', async (error, statusCode) => {
    await expect(logExternalCall('test', 'request', async () => { throw error })).rejects.toBe(error)
    expect(logger.info).toHaveBeenCalledExactlyOnceWith({
      service: 'test', operation: 'request', durationMs: expect.any(Number), statusCode, outcome: 'failure'
    }, 'External API call failed')
    expect(JSON.stringify([logger.info.mock.calls, logger.debug.mock.calls])).not.toContain('private response')
  })

  test.each(['secret', 99, 600, 200.5, NaN])('ignores invalid status values: %j', async status => {
    await logExternalCall('test', 'request', async () => ({ status }))
    expect(logger.info.mock.calls[0][0].statusCode).toBeUndefined()
    expect(JSON.stringify([logger.info.mock.calls, logger.debug.mock.calls])).not.toContain('secret')
  })

  test('does not log tokens, bodies, headers or URLs returned by an SDK', async () => {
    const response = { access_token: 'private token', refresh_token: 'private refresh token', headers: { authorization: 'private authorization' }, data: { email: 'private recipient' }, url: 'https://example.com/private-url' }
    expect(await logExternalCall('OIDC', 'refreshTokenGrant', async () => response)).toBe(response)
    expect(logger.info).toHaveBeenCalledOnce()
    expect(logger.debug).toHaveBeenCalledTimes(2)
    expect(JSON.stringify([logger.info.mock.calls, logger.debug.mock.calls])).not.toContain('private')
  })

  test('forwards fetch arguments without logging secrets', async () => {
    const response = { status: 200 }
    const fetch = vi.fn().mockResolvedValue(response)
    vi.stubGlobal('fetch', fetch)
    const url = 'https://example.com/?key=secret'
    const options = { method: 'POST', headers: { authorization: 'secret' } }
    await expect(logExternalCall('test', 'fetch', () => fetch(url, options))).resolves.toBe(response)
    expect(fetch).toHaveBeenCalledWith(url, options)
    expect(JSON.stringify([logger.info.mock.calls, logger.debug.mock.calls])).not.toContain('secret')
  })
})
