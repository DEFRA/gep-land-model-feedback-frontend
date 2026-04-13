import { privacyController } from './controller.js'

export const privacy = {
  plugin: {
    name: 'privacy',
    register (server) {
      server.route([
        {
          method: 'GET',
          path: '/privacy',
          ...privacyController
        }
      ])
    }
  }
}
