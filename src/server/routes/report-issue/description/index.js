import { descriptionController, descriptionPostController } from './controller.js'

export const description = {
  plugin: {
    name: 'report-issue-description',
    register (server) {
      server.route([
        {
          method: 'GET',
          path: '/report-issue/description',
          ...descriptionController
        },
        {
          method: 'POST',
          path: '/report-issue/description',
          ...descriptionPostController
        }
      ])
    }
  }
}
