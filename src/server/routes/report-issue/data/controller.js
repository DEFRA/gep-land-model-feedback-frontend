import Joi from 'joi'

const datasetQuestion = 'Which dataset is the issue within?'
const locationQuestion = 'Enter the location of the issue'
const locationOptions = [
  { value: 'grid', name: 'gridReference', id: 'grid-reference', text: 'Grid cell', label: 'Land model grid cell reference (British National Grid)', hint: 'For example, SK1481' },
  { value: 'feature', name: 'featureReference', id: 'feature-reference', text: 'Feature', label: 'Land model feature reference (OSID)', hint: 'For example, 1e2f9011-ece7-4068-80ec-27e837259cf8' },
  { value: 'other', name: 'locationDescription', id: 'location-description', text: 'Other', label: 'Describe the location', hint: 'Enter as much information as possible to help us locate the issue' }
]
const locationFields = Object.fromEntries(locationOptions.map(({ name, value }) => [name, Joi.when('locationType', {
  is: value,
  then: Joi.string().trim().required(),
  otherwise: Joi.any().strip()
})]))
const locationSchema = Joi.object({
  locationType: Joi.string().valid(...locationOptions.map(({ value }) => value)).required(),
  ...locationFields
}).options({ stripUnknown: true })

function errors (question, errorList) {
  return {
    question,
    pageTitle: `${errorList.length ? 'Error: ' : ''}${question}`,
    errorSummary: errorList.length ? { titleText: 'There is a problem', errorList } : undefined
  }
}

function datasetModel (dataset, invalid = false) {
  const text = 'Select which dataset the issue is within'
  return {
    ...errors(datasetQuestion, invalid ? [{ text, href: '#dataset' }] : []),
    dataset,
    datasetError: invalid ? { text } : undefined
  }
}

function locationModel (values = {}, details = []) {
  const hasError = name => details.some(({ path }) => path[0] === name)
  const typeError = hasError('locationType') ? { text: 'Select how you want to identify the location of the issue' } : undefined
  const options = locationOptions.map(option => ({
    ...option,
    inputValue: typeof values[option.name] === 'string' ? values[option.name] : '',
    error: hasError(option.name) ? { text: locationQuestion } : undefined
  }))
  return {
    ...errors(locationQuestion, [
      ...(typeError ? [{ text: typeError.text, href: '#location-type' }] : []),
      ...options.filter(({ error }) => error).map(({ error, id }) => ({ text: error.text, href: `#${id}` }))
    ]),
    locationType: typeof values.locationType === 'string' ? values.locationType : '',
    typeError,
    options
  }
}

function guard (request) {
  if (request.yar.get('issueType') !== 'data') return '/'
  if (request.yar.get('dataset') !== 'land-model') return '/report-issue/data'
}

export const datasetGetController = {
  handler (request, h) {
    if (request.yar.get('issueType') !== 'data') return h.redirect('/').code(303)
    return h.view('report-issue/data/index', datasetModel(request.yar.get('dataset')))
  }
}

export const datasetPostController = {
  options: {
    validate: {
      payload: Joi.object({ dataset: Joi.string().valid('land-model').required() }).options({ stripUnknown: true }),
      failAction (request, h) {
        if (request.yar.get('issueType') !== 'data') return h.redirect('/').code(303).takeover()
        return h.view('report-issue/data/index', datasetModel(undefined, true)).code(400).takeover()
      }
    }
  },
  handler (request, h) {
    if (request.yar.get('issueType') !== 'data') return h.redirect('/').code(303)
    request.yar.set('dataset', request.payload.dataset)
    return h.redirect('/report-issue/data/location').code(303)
  }
}

export const locationGetController = {
  handler (request, h) {
    const redirect = guard(request)
    if (redirect) return h.redirect(redirect).code(303)
    return h.view('report-issue/data/location', locationModel(request.yar.get('issueLocation') ?? {}))
  }
}

export const locationPostController = {
  options: {
    validate: {
      payload: locationSchema,
      failAction (request, h, error) {
        const redirect = guard(request)
        if (redirect) return h.redirect(redirect).code(303).takeover()
        return h.view('report-issue/data/location', locationModel(request.payload, error.details)).code(400).takeover()
      }
    }
  },
  handler (request, h) {
    const redirect = guard(request)
    if (redirect) return h.redirect(redirect).code(303)
    request.yar.set('issueLocation', request.payload)
    return h.redirect('/report-issue/data/attributes').code(303)
  }
}

export const attributesController = {
  handler (request, h) {
    const redirect = guard(request)
    if (redirect) return h.redirect(redirect).code(303)
    if (locationSchema.validate(request.yar.get('issueLocation') ?? {}).error) return h.redirect('/report-issue/data/location').code(303)
    return h.view('report-issue/data/attributes', { pageTitle: 'Which attributes are incorrect?' })
  }
}
