import { statusCodes } from '#/server/common/constants/status-codes.js'
import { nextPage } from '../navigation.js'
import { isTechnicalIssue } from '../helpers/prerequisites.js'
import { technicalSchema } from './schema.js'
import { buildViewModel } from './view-model.js'

export const technicalGetController = {
  handler (request, h) {
    if (!isTechnicalIssue(request)) {
      return h.redirect('/').code(statusCodes.seeOther)
    }
    return h.view('report-issue/technical/index', buildViewModel(request, {
      technicalArea: request.yar.get('technicalArea'),
      technicalOther: request.yar.get('technicalOther')
    }))
  }
}

export const technicalPostController = {
  options: {
    validate: {
      payload: technicalSchema,
      failAction (request, h, error) {
        if (!isTechnicalIssue(request)) {
          return h.redirect('/').code(statusCodes.seeOther).takeover()
        }
        return h.view('report-issue/technical/index', buildViewModel(request, request.payload, error.details))
          .code(statusCodes.badRequest)
          .takeover()
      }
    }
  },
  handler (request, h) {
    if (!isTechnicalIssue(request)) {
      return h.redirect('/').code(statusCodes.seeOther)
    }
    const { technicalArea, technicalOther } = request.payload
    request.yar.set('technicalArea', technicalArea)
    request.yar.set('technicalOther', technicalArea === 'other' ? technicalOther : null)
    return h.redirect(nextPage(request, '/report-issue/description')).code(statusCodes.seeOther)
  }
}
