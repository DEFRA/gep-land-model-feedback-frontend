import { statusCodes } from '#/server/common/constants/status-codes.js'
import { listDatasets } from '#/server/common/services/geonetwork/client.js'
import { nextPage } from '../navigation.js'
import { datasetSchema } from './schema.js'
import { buildDatasetViewModel } from './view-model.js'

const DATASET_TEMPLATE = 'report-issue/data/index'

async function datasetPage (request, h, values, errorField, status = statusCodes.ok) {
  let datasets = []
  let catalogueError = false
  try {
    datasets = await listDatasets()
  } catch {
    catalogueError = true
    request.logger.error('Failed to load datasets from GeoNetwork')
  }
  return h.view(DATASET_TEMPLATE, buildDatasetViewModel(request, values, datasets, errorField, catalogueError))
    .code(catalogueError && values.dataset === 'other' ? statusCodes.serviceUnavailable : status)
}

export const datasetGetController = {
  handler (request, h) {
    if (request.yar.get('issueType') !== 'data') {
      return h.redirect('/').code(statusCodes.seeOther)
    }
    return datasetPage(request, h, { dataset: request.yar.get('dataset'), datasetOtherId: request.yar.get('datasetOtherId') })
  }
}

export const datasetPostController = {
  options: {
    validate: {
      payload: datasetSchema,
      async failAction (request, h, error) {
        if (request.yar.get('issueType') !== 'data') {
          return h.redirect('/').code(statusCodes.seeOther).takeover()
        }
        const field = error.details[0].path[0]
        const response = await datasetPage(request, h, request.payload, field, statusCodes.badRequest)
        return response.takeover()
      }
    }
  },
  async handler (request, h) {
    if (request.yar.get('issueType') !== 'data') {
      return h.redirect('/').code(statusCodes.seeOther)
    }
    const { dataset, datasetOtherId } = request.payload
    let selected
    if (dataset === 'other') {
      let datasets
      try {
        datasets = await listDatasets()
      } catch {
        request.logger.error('Failed to validate selected GeoNetwork dataset')
        return h.view(DATASET_TEMPLATE, buildDatasetViewModel(request, request.payload, [], undefined, true)).code(statusCodes.serviceUnavailable)
      }
      selected = datasets.find(({ id }) => id === datasetOtherId)
      if (!selected) {
        return h.view(DATASET_TEMPLATE, buildDatasetViewModel(request, request.payload, datasets, 'datasetOtherId')).code(statusCodes.badRequest)
      }
    }
    request.yar.set('dataset', dataset)
    request.yar.set('datasetOtherId', selected?.id ?? null)
    request.yar.set('datasetOtherTitle', selected?.title ?? null)
    return h.redirect(nextPage(request, dataset === 'other' ? '/report-issue/description' : '/report-issue/data/location')).code(statusCodes.seeOther)
  }
}
