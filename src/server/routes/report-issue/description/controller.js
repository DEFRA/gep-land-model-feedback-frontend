import { statusCodes } from '#/server/common/constants/status-codes.js'
import { nextPage } from '../navigation.js'
import { getDescriptionRedirect, isOtherDataset } from '../helpers/prerequisites.js'
import { createDescriptionPayloadSchema } from './schema.js'
import { buildViewModel } from './view-model.js'

export const descriptionController = {
  handler (request, h) {
    const redirect = getDescriptionRedirect(request)
    if (redirect) return h.redirect(redirect).code(statusCodes.seeOther)
    return h.view('report-issue/description/index', buildViewModel(request, request.yar.get('issueDescription')))
  }
}

export const descriptionPostController = {
  handler (request, h) {
    const redirect = getDescriptionRedirect(request)
    if (redirect) return h.redirect(redirect).code(statusCodes.seeOther)
    const other = isOtherDataset(request)
    const { value, error } = createDescriptionPayloadSchema(other).validate(request.payload, { stripUnknown: true, abortEarly: false })
    if (error) {
      return h.view('report-issue/description/index', buildViewModel(request, request.payload?.issueDescription, error)).code(statusCodes.badRequest)
    }
    request.yar.set('issueWhere', other ? value.issueWhere : null)
    request.yar.set('issueDescription', value.issueDescription)
    return h.redirect(nextPage(request, '/report-issue/evidence')).code(statusCodes.seeOther)
  }
}
