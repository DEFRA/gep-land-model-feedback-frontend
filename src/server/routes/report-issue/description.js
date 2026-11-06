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
    ...getChangeNavigation(request, '/report-issue/description', request.yar.get('issueType') === 'data' ? (request.yar.get('dataset') === 'other' ? '/report-issue/data' : '/report-issue/data/attributes') : '/report-issue/technical'),
    isOtherDataset: request.yar.get('issueType') === 'data' && request.yar.get('dataset') === 'other',
    issueWhere: request.method === 'post' ? (typeof request.payload?.issueWhere === 'string' ? request.payload.issueWhere : '') : request.yar.get('issueWhere'),
    whereError: error?.details.some(({ path }) => path[0] === 'issueWhere') ? { text: 'Enter the location of the issue' } : undefined,
    issueDescription: typeof description === 'string' ? description : '',
    descriptionError: error?.details.some(({ path }) => path[0] === 'issueDescription') ? { text: message } : undefined,
    errorSummary: error ? { titleText: 'There is a problem', errorList: error.details.map(({ path }) => path[0] === 'issueWhere' ? { text: 'Enter the location of the issue', href: '#issue-where' } : { text: message, href: '#issue-description' }) } : undefined
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
  handler (request, h) {
    const redirect = getDescriptionRedirect(request)
    if (redirect) return h.redirect(redirect).code(303)
    const other = request.yar.get('issueType') === 'data' && request.yar.get('dataset') === 'other'
    const { value, error } = Joi.object({
      issueWhere: other ? Joi.string().trim().required() : Joi.any().strip(),
      issueDescription: descriptionSchema
    }).required().validate(request.payload, { stripUnknown: true, abortEarly: false })
    if (error) {
      return h.view('report-issue/description', pageModel(request, request.payload?.issueDescription, error)).code(400)
    }
    request.yar.set('issueWhere', other ? value.issueWhere : null)
    request.yar.set('issueDescription', value.issueDescription)
    return h.redirect(nextPage(request, '/report-issue/evidence')).code(303)
  }
}
