import { Engine as CatboxRedis } from '@hapi/catbox-redis'
import { Engine as CatboxMemory } from '@hapi/catbox-memory'

import { createLogger } from '../logging/logger.js'
import { buildRedisClient } from '../redis-client.js'
import { config } from '#/config/config.js'

export function getCacheEngine (engine) {
  const logger = createLogger()

  if (engine === 'redis') {
    logger.info('Using Redis session cache')
    const redisClient = buildRedisClient(config.get('redis'))
    return new CatboxRedis({ client: redisClient })
  }

  if (config.get('isProduction') && !config.get('isTest')) {
    logger.error(
      'Catbox Memory is for local development only, it should not be used in production!'
    )
    throw new Error('Production sessions require a distributed Redis cache')
  }

  logger.info('Using Catbox Memory session cache')
  return new CatboxMemory()
}
