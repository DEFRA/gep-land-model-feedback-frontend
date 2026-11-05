import { technicalGetController, technicalPostController, descriptionController } from './technical/controller.js'
import { datasetGetController, datasetPostController, locationGetController, locationPostController, attributesController } from './data/controller.js'

export const reportIssue = {
  plugin: {
    name: 'report-issue',
    register (server) {
      server.route([
        { method: 'GET', path: '/report-issue/data', ...datasetGetController },
        { method: 'POST', path: '/report-issue/data', ...datasetPostController },
        { method: 'GET', path: '/report-issue/data/location', ...locationGetController },
        { method: 'POST', path: '/report-issue/data/location', ...locationPostController },
        { method: 'GET', path: '/report-issue/data/attributes', ...attributesController },
        { method: 'GET', path: '/report-issue/technical', ...technicalGetController },
        { method: 'POST', path: '/report-issue/technical', ...technicalPostController },
        { method: 'GET', path: '/report-issue/technical/description', ...descriptionController }
      ])
    }
  }
}
