import { createLogger, logExternalCall } from './logger.js'
import { loggerOptions } from './logger-options.js'
import { pino } from 'pino'

const logger = vi.hoisted(() => ({ debug: vi.fn() }))
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

  test.each([{ status: 503 }, { statusCode: 200 }, { $metadata: { httpStatusCode: 206 } }])('preserves responses and records status', async (response) => {
    const result = await logExternalCall('test', 'read', async () => response)
    expect(result).toBe(response)
    expect(logger.debug).toHaveBeenCalledWith({ service: 'test', operation: 'read' }, 'External API call started')
    expect(logger.debug).toHaveBeenCalledWith({ service: 'test', operation: 'read', durationMs: expect.any(Number), statusCode: response.status ?? response.statusCode ?? response.$metadata?.httpStatusCode }, 'External API call completed')
  })

  test('measures elapsed time using the monotonic clock', async () => {
    const now = vi.spyOn(performance, 'now').mockReturnValueOnce(100).mockReturnValueOnce(125)
    try {
      await logExternalCall('test', 'request', async () => undefined)
      expect(logger.debug).toHaveBeenLastCalledWith({
        service: 'test', operation: 'request', durationMs: 25, statusCode: undefined
      }, 'External API call completed')
    } finally {
      now.mockRestore()
    }
  })

  test('preserves errors without logging potentially sensitive error details', async () => {
    const error = new Error('https://example.com/?key=secret')
    await expect(logExternalCall('test', 'read', async () => { throw error })).rejects.toBe(error)
    expect(logger.debug).toHaveBeenCalledWith({ service: 'test', operation: 'read', durationMs: expect.any(Number) }, 'External API call failed')
    expect(JSON.stringify(logger.debug.mock.calls)).not.toContain('secret')
  })

  test('forwards fetch arguments without logging secrets', async () => {
    const response = { status: 200 }
    const fetch = vi.fn().mockResolvedValue(response)
    vi.stubGlobal('fetch', fetch)
    const url = 'https://example.com/?key=secret'
    const options = { method: 'POST', headers: { authorization: 'secret' } }
    await expect(logExternalCall('test', 'fetch', () => fetch(url, options))).resolves.toBe(response)
    expect(fetch).toHaveBeenCalledWith(url, options)
    expect(JSON.stringify(logger.debug.mock.calls)).not.toContain('secret')
  })
})
