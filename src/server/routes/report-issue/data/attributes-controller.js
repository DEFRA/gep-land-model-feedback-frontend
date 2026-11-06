import { statusCodes } from '#/server/common/constants/status-codes.js'
import { nextPage } from '../navigation.js'
import { getAttributesRedirect } from '../helpers/prerequisites.js'
import { attributesPayloadSchema } from './schema.js'
import { buildAttributesViewModel } from './view-model.js'

export const attributesController = {
  handler (request, h) {
    const redirect = getAttributesRedirect(request)
    if (redirect) return h.redirect(redirect).code(statusCodes.seeOther)
    return h.view('report-issue/data/attributes', buildAttributesViewModel(request, request.yar.get('incorrectAttributes')))
  }
}

export const attributesPostController = {
  options: {
    validate: {
      payload: attributesPayloadSchema,
      failAction (request, h) {
        const redirect = getAttributesRedirect(request)
        if (redirect) return h.redirect(redirect).code(statusCodes.seeOther).takeover()
        return h.view('report-issue/data/attributes', buildAttributesViewModel(request, request.payload.attributes, true)).code(statusCodes.badRequest).takeover()
      }
    }
  },
  handler (request, h) {
    const redirect = getAttributesRedirect(request)
    if (redirect) return h.redirect(redirect).code(statusCodes.seeOther)
    request.yar.set('incorrectAttributes', request.payload.attributes)
    return h.redirect(nextPage(request, '/report-issue/description')).code(statusCodes.seeOther)
  }
}
