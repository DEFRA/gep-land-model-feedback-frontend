import { getChangeNavigation } from './navigation.js'
import { descriptionSchema, getDescriptionRedirect } from './description.js'

export function getEvidenceRedirect (request) {
  return getDescriptionRedirect(request) || ((descriptionSchema.validate(request.yar.get('issueDescription')).error || (request.yar.get('issueType') === 'data' && request.yar.get('dataset') === 'other' && !request.yar.get('issueWhere')))
    ? '/report-issue/description'
    : undefined)
}

export const evidenceController = {
  handler (request, h) {
    const redirect = getEvidenceRedirect(request)
    if (redirect) return h.redirect(redirect).code(303)
    return h.view('report-issue/evidence', { pageTitle: 'Add any evidence of the issue', ...getChangeNavigation(request, '/report-issue/evidence', '/report-issue/description') })
  }
}
