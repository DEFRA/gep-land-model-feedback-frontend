import { getDataDescriptionRedirect } from './data/controller.js'
import { getTechnicalDescriptionRedirect } from './technical/controller.js'

export const descriptionController = {
  handler (request, h) {
    const issueType = request.yar.get('issueType')
    if (issueType !== 'data' && issueType !== 'technical') return h.redirect('/').code(303)
    const redirect = issueType === 'data' ? getDataDescriptionRedirect(request) : getTechnicalDescriptionRedirect(request)
    if (redirect) return h.redirect(redirect).code(303)
    return h.view('report-issue/description', {
      pageTitle: 'Enter a description of the issue',
      backLink: issueType === 'data' ? '/report-issue/data/attributes' : '/report-issue/technical'
    })
  }
}
