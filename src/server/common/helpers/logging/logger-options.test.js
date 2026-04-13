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
})
