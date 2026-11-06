import { statusCodes } from '#/server/common/constants/status-codes.js'
import { nextPage } from '../navigation.js'
import { getLocationRedirect } from '../helpers/prerequisites.js'
import { locationSchema } from './schema.js'
import { buildLocationViewModel } from './view-model.js'

export const locationGetController = {
  handler (request, h) {
    const redirect = getLocationRedirect(request)
    if (redirect) return h.redirect(redirect).code(statusCodes.seeOther)
    return h.view('report-issue/data/location', buildLocationViewModel(request, request.yar.get('issueLocation') ?? {}))
  }
}

export const locationPostController = {
  options: {
    validate: {
      payload: locationSchema,
      failAction (request, h, error) {
        const redirect = getLocationRedirect(request)
        if (redirect) return h.redirect(redirect).code(statusCodes.seeOther).takeover()
        return h.view('report-issue/data/location', buildLocationViewModel(request, request.payload, error.details)).code(statusCodes.badRequest).takeover()
      }
    }
  },
  handler (request, h) {
    const redirect = getLocationRedirect(request)
    if (redirect) return h.redirect(redirect).code(statusCodes.seeOther)
    request.yar.set('issueLocation', request.payload)
    return h.redirect(nextPage(request, '/report-issue/data/attributes')).code(statusCodes.seeOther)
  }
}
