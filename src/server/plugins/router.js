import inert from '@hapi/inert'
import { config } from '#/config/config.js'

import { home } from '#/server/routes/home/index.js'
import { about } from '#/server/routes/about/index.js'
import { cookies } from '#/server/routes/cookies/controller.js'
import { privacy } from '#/server/routes/privacy/index.js'
import { accessibilityStatement } from '#/server/routes/accessibility-statement/index.js'
import { health } from '#/server/routes/health/index.js'
import { serveStaticFiles } from './serve-static-files.js'

export const router = {
  plugin: {
    name: 'router',
    async register (server) {
      await server.register([inert])

      // Health-check route. Used by platform to check if service is running, do not remove!
      await server.register([health])

      // Application specific routes, add your own routes here
      await server.register([home, about, cookies, privacy, accessibilityStatement])

      // Static assets
      if (!config.get('isProduction') && !config.get('isTest')) {
        await (async () => {
          const createViteServer = (await import('vite')).createServer
          const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'custom'
          })

          server.ext('onPostStop', () => vite.close())

          await server.register({
            plugin: (await import('@defra/hapi-connect')).default,
            options: {
              path: '/public',
              middleware: [vite.middlewares]
            }
          })
        })()
      } else {
        await server.register(serveStaticFiles)
      }
    }
  }
}
