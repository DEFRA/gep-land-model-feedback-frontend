import { config } from '../../../../config/config.js'

function setupCaches (server) {
  const sessionConfig = config.get('session')
  const session = server.cache({
    cache: sessionConfig.cache.name,
    segment: sessionConfig.cache.segment,
    expiresIn: sessionConfig.cache.ttl
  })

  server.decorate('server', 'session', session)
}

export { setupCaches }
