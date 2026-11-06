import { homeController, issueTypeController } from './controller.js'

/**
 * Sets up the routes used in the home page.
 * These routes are registered in src/server/plugins/router.js.
 */
export const home = {
  plugin: {
    name: 'home',
    register (server) {
      server.route([
        {
          method: 'GET',
          path: '/',
          ...homeController
        },
        {
          method: 'POST',
          path: '/',
          ...issueTypeController
        }
      ])
    }
  }
}
