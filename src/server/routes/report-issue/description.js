import { getChangeNavigation, nextPage } from './navigation.js'
import Joi from 'joi'
import { getDataDescriptionRedirect } from './data/controller.js'
import { getTechnicalDescriptionRedirect } from './technical/controller.js'

const question = 'Enter a description of the issue'
export const descriptionSchema = Joi.string().trim().max(2000).required()

export function getDescriptionRedirect (request) {
  const issueType = request.yar.get('issueType')
  if (issueType !== 'data' && issueType !== 'technical') return '/'
  return issueType === 'data' ? getDataDescriptionRedirect(request) : getTechnicalDescriptionRedirect(request)
}

function pageModel (request, description, error) {
  const message = error?.details.some(({ type }) => type === 'string.max')
    ? 'The description must be 2,000 characters or fewer'
    : question
  return {
    pageTitle: `${error ? 'Error: ' : ''}${question}`,
    question,
    ...getChangeNavigation(request, '/report-issue/description', request.yar.get('issueType') === 'data' ? '/report-issue/data/attributes' : '/report-issue/technical'),
    issueDescription: typeof description === 'string' ? description : '',
    descriptionError: error ? { text: message } : undefined,
    errorSummary: error ? { titleText: 'There is a problem', errorList: [{ text: message, href: '#issue-description' }] } : undefined
  }
}

export const descriptionController = {
  handler (request, h) {
    const redirect = getDescriptionRedirect(request)
    if (redirect) return h.redirect(redirect).code(303)
    return h.view('report-issue/description', pageModel(request, request.yar.get('issueDescription')))
  }
}

export const descriptionPostController = {
  options: {
    validate: {
      payload: Joi.object({ issueDescription: descriptionSchema }).options({ stripUnknown: true }),
      failAction (request, h, error) {
        const redirect = getDescriptionRedirect(request)
        if (redirect) return h.redirect(redirect).code(303).takeover()
        return h.view('report-issue/description', pageModel(request, request.payload.issueDescription, error)).code(400).takeover()
      }
    }
  },
  handler (request, h) {
    const redirect = getDescriptionRedirect(request)
    if (redirect) return h.redirect(redirect).code(303)
    request.yar.set('issueDescription', request.payload.issueDescription)
    return h.redirect(nextPage(request, '/report-issue/evidence')).code(303)
  }
}
