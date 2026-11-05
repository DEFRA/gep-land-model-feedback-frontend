import { vi, describe, test, expect, beforeEach } from 'vitest'

const mockGetTraceId = vi.fn()

vi.mock('@defra/hapi-tracing', () => ({
  getTraceId: mockGetTraceId
}))

vi.mock('@elastic/ecs-pino-format', () => ({
  ecsFormat: (opts) => ({
    messageKey: 'message',
    serviceName: opts.serviceName,
    serviceVersion: opts.serviceVersion
  })
}))

describe('#loggerOptions', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  describe('#mixin', () => {
    test('Should return trace id when available', async () => {
      mockGetTraceId.mockReturnValue('abc-123')

      const { loggerOptions } = await import('./logger-options.js')
      const result = loggerOptions.mixin()

      expect(result).toEqual({ trace: { id: 'abc-123' } })
    })

    test('Should return empty object when no trace id', async () => {
      mockGetTraceId.mockReturnValue(null)

      const { loggerOptions } = await import('./logger-options.js')
      const result = loggerOptions.mixin()

      expect(result).toEqual({})
    })
  })

  describe('pino-pretty serializers', () => {
    test('req serializer logs request detail only for server errors', async () => {
      const { loggerOptions } = await import('./logger-options.js')
      const req = {
        method: 'GET',
        url: '/map',
        query: { f: 'json' },
        headers: { host: 'localhost' },
        response: { statusCode: 500 }
      }

      expect(loggerOptions.serializers.req(req)).toEqual({
        method: 'GET',
        url: '/map',
        query: { f: 'json' },
        headers: { host: 'localhost' }
      })
      expect(loggerOptions.serializers.req({ response: { statusCode: 200 } })).toBeUndefined()
      expect(loggerOptions.serializers.req({})).toBeUndefined()
    })

    test('res serializer logs response detail only for server errors', async () => {
      const { loggerOptions } = await import('./logger-options.js')
      const res = {
        statusCode: 503,
        getHeaders: () => ({ 'content-type': 'text/html' })
      }

      expect(loggerOptions.serializers.res(res)).toEqual({
        statusCode: 503,
        headers: { 'content-type': 'text/html' }
      })
      expect(loggerOptions.serializers.res({ statusCode: 500 })).toEqual({ statusCode: 500, headers: undefined })
      expect(loggerOptions.serializers.res({ statusCode: 200 })).toBeUndefined()
    })

    test('customRequestCompleteMessage formats method, path, status and time', async () => {
      const { loggerOptions } = await import('./logger-options.js')
      const request = {
        method: 'get',
        path: '/os/vts/tile/7/63/42.pbf',
        response: { statusCode: 200 }
      }

      expect(loggerOptions.customRequestCompleteMessage(request, 12)).toBe('GET /os/vts/tile/7/63/42.pbf 200 (12ms)')
    })
  })
})
