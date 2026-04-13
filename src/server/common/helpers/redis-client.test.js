import { vi, describe, test, expect, beforeEach } from 'vitest'

import { Cluster, Redis } from 'ioredis'

import { config } from '../../../config/config.js'
import { buildRedisClient } from './redis-client.js'

const mockLoggerInfo = vi.fn()
const mockLoggerError = vi.fn()

vi.mock('./logging/logger.js', () => ({
  createLogger: () => ({
    info: mockLoggerInfo,
    error: mockLoggerError
  })
}))

vi.mock('ioredis', () => {
  function createMockClient () {
    const handlers = {}
    this.on = vi.fn((event, handler) => {
      handlers[event] = handler
    })
    this._trigger = (event, ...args) => handlers[event]?.(...args)
  }
  return {
    Cluster: vi.fn().mockImplementation(function () {
      createMockClient.call(this)
    }),
    Redis: vi.fn().mockImplementation(function () {
      createMockClient.call(this)
    })
  }
})

describe('#buildRedisClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('When Redis Single InstanceCache is requested', () => {
    test('Should instantiate a single Redis client', () => {
      buildRedisClient(config.get('redis'))

      expect(Redis).toHaveBeenCalledWith({
        db: 0,
        host: '127.0.0.1',
        keyPrefix: 'gep-land-model-feedback-frontend:',
        port: 6379
      })
    })
  })

  describe('When a Redis Cluster is requested', () => {
    test('Should instantiate a Redis Cluster client', () => {
      buildRedisClient({
        ...config.get('redis'),
        useSingleInstanceCache: false,
        useTLS: true,
        username: 'user',
        password: 'pass'
      })

      expect(Cluster).toHaveBeenCalledWith(
        [{ host: '127.0.0.1', port: 6379 }],
        {
          dnsLookup: expect.any(Function),
          keyPrefix: 'gep-land-model-feedback-frontend:',
          redisOptions: { db: 0, password: 'pass', tls: {}, username: 'user' },
          slotsRefreshTimeout: 10000
        }
      )
    })
  })

  describe('Event handlers', () => {
    test('Should log on connect', () => {
      const client = buildRedisClient(config.get('redis'))

      client._trigger('connect')

      expect(mockLoggerInfo).toHaveBeenCalledWith('Connected to Redis server')
    })

    test('Should log on error', () => {
      const client = buildRedisClient(config.get('redis'))
      const error = new Error('connection refused')

      client._trigger('error', error)

      expect(mockLoggerError).toHaveBeenCalledWith(
        `Redis connection error ${error}`
      )
    })
  })

  describe('DNS lookup callback', () => {
    test('Should resolve address directly', () => {
      buildRedisClient({
        ...config.get('redis'),
        useSingleInstanceCache: false,
        username: '',
        password: ''
      })

      const clusterArgs = Cluster.mock.calls[0][1]
      const callback = vi.fn()

      clusterArgs.dnsLookup('redis.example.com', callback)

      expect(callback).toHaveBeenCalledWith(null, 'redis.example.com')
    })
  })
})
