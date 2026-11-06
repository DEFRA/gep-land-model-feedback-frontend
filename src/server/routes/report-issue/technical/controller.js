import Joi from 'joi'

const question = 'What does the technical issue relate to?'
const areaMessage = 'Select what the technical issue relates to'
const otherMessage = 'Enter what the issue relates to'
const options = [
  { value: 'map-viewer', text: 'ATLAS Map Viewer' },
  { value: 'data-search', text: 'ATLAS Data Search & Find' },
  { value: 'repository-integration', text: 'ATLAS Repository Integration' },
  { value: 'data-ingestion', text: 'ATLAS data ingestion' },
  { value: 'data-export', text: 'ATLAS data export' }
]
const allowedAreas = [...options.map(({ value }) => value), 'other']

function pageModel (values, details = []) {
  const areaError = details.some(({ path }) => path[0] === 'technicalArea')
  const otherError = details.some(({ path }) => path[0] === 'technicalOther')
  const errorList = [
    ...(areaError ? [{ text: areaMessage, href: '#technical-area' }] : []),
    ...(otherError ? [{ text: otherMessage, href: '#technical-other' }] : [])
  ]
  return {
    pageTitle: `${errorList.length ? 'Error: ' : ''}${question}`,
    question,
    options,
    technicalArea: typeof values.technicalArea === 'string' ? values.technicalArea : '',
    technicalOther: typeof values.technicalOther === 'string' ? values.technicalOther : '',
    areaError: areaError ? { text: areaMessage } : undefined,
    otherError: otherError ? { text: otherMessage } : undefined,
    errorSummary: errorList.length ? { titleText: 'There is a problem', errorList } : undefined
  }
}

function isTechnicalIssue (request) {
  return request.yar.get('issueType') === 'technical'
}

export const technicalGetController = {
  handler (request, h) {
    if (!isTechnicalIssue(request)) {
      return h.redirect('/').code(303)
    }
    return h.view('report-issue/technical/index', pageModel({
      technicalArea: request.yar.get('technicalArea'),
      technicalOther: request.yar.get('technicalOther')
    }))
  }
}

export const technicalPostController = {
  options: {
    validate: {
      payload: Joi.object({
        technicalArea: Joi.string().valid(...allowedAreas).required(),
        technicalOther: Joi.when('technicalArea', {
          is: 'other',
          then: Joi.string().trim().required(),
          otherwise: Joi.any().strip()
        })
      }).options({ stripUnknown: true }),
      failAction (request, h, error) {
        if (!isTechnicalIssue(request)) {
          return h.redirect('/').code(303).takeover()
        }
        return h.view('report-issue/technical/index', pageModel(request.payload, error.details))
          .code(400)
          .takeover()
      }
    }
  },
  handler (request, h) {
    if (!isTechnicalIssue(request)) {
      return h.redirect('/').code(303)
    }
    const { technicalArea, technicalOther } = request.payload
    request.yar.set('technicalArea', technicalArea)
    request.yar.set('technicalOther', technicalArea === 'other' ? technicalOther : null)
    return h.redirect('/report-issue/description').code(303)
  }
}

export function getTechnicalDescriptionRedirect (request) {
  if (!isTechnicalIssue(request)) return '/'
  const area = request.yar.get('technicalArea')
  if (!allowedAreas.includes(area) || (area === 'other' && !request.yar.get('technicalOther'))) {
    return '/report-issue/technical'
  }
}
