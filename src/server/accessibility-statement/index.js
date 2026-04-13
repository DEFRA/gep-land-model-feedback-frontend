import { accessibilityStatementController } from './controller.js'

export const accessibilityStatement = {
  plugin: {
    name: 'accessibility-statement',
    register (server) {
      server.route([
        {
          method: 'GET',
          path: '/accessibility-statement',
          ...accessibilityStatementController
        }
      ])
    }
  }
}
