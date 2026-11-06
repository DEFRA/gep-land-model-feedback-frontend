import { datasetGetController, datasetPostController } from './controller.js'
import { locationGetController, locationPostController } from './location-controller.js'
import { attributesController, attributesPostController } from './attributes-controller.js'

export const dataIssue = {
  plugin: {
    name: 'report-issue-data',
    register (server) {
      server.route([
        {
          method: 'GET',
          path: '/report-issue/data',
          ...datasetGetController
        },
        {
          method: 'POST',
          path: '/report-issue/data',
          ...datasetPostController
        },
        {
          method: 'GET',
          path: '/report-issue/data/location',
          ...locationGetController
        },
        {
          method: 'POST',
          path: '/report-issue/data/location',
          ...locationPostController
        },
        {
          method: 'GET',
          path: '/report-issue/data/attributes',
          ...attributesController
        },
        {
          method: 'POST',
          path: '/report-issue/data/attributes',
          ...attributesPostController
        }
      ])
    }
  }
}
