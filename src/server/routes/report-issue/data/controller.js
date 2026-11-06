import { getChangeNavigation, nextPage } from '../navigation.js'
import Joi from 'joi'

const datasetQuestion = 'Which dataset is the issue within?'
const locationQuestion = 'Enter the location of the issue'
export const locationOptions = [
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

function datasetModel (request, dataset, invalid = false) {
  const text = 'Select which dataset the issue is within'
  return {
    ...getChangeNavigation(request, '/report-issue/data', '/'),
    ...errors(datasetQuestion, invalid ? [{ text, href: '#dataset' }] : []),
    dataset,
    datasetError: invalid ? { text } : undefined
  }
}

function locationModel (request, values = {}, details = []) {
  const hasError = name => details.some(({ path }) => path[0] === name)
  const typeError = hasError('locationType') ? { text: 'Select how you want to identify the location of the issue' } : undefined
  const options = locationOptions.map(option => ({
    ...option,
    inputValue: typeof values[option.name] === 'string' ? values[option.name] : '',
    error: hasError(option.name) ? { text: locationQuestion } : undefined
  }))
  return {
    ...getChangeNavigation(request, '/report-issue/data/location', '/report-issue/data'),
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
    return h.view('report-issue/data/index', datasetModel(request, request.yar.get('dataset')))
  }
}

export const datasetPostController = {
  options: {
    validate: {
      payload: Joi.object({ dataset: Joi.string().valid('land-model').required() }).options({ stripUnknown: true }),
      failAction (request, h) {
        if (request.yar.get('issueType') !== 'data') return h.redirect('/').code(303).takeover()
        return h.view('report-issue/data/index', datasetModel(request, undefined, true)).code(400).takeover()
      }
    }
  },
  handler (request, h) {
    if (request.yar.get('issueType') !== 'data') return h.redirect('/').code(303)
    request.yar.set('dataset', request.payload.dataset)
    return h.redirect(nextPage(request, '/report-issue/data/location')).code(303)
  }
}

export const locationGetController = {
  handler (request, h) {
    const redirect = guard(request)
    if (redirect) return h.redirect(redirect).code(303)
    return h.view('report-issue/data/location', locationModel(request, request.yar.get('issueLocation') ?? {}))
  }
}

export const locationPostController = {
  options: {
    validate: {
      payload: locationSchema,
      failAction (request, h, error) {
        const redirect = guard(request)
        if (redirect) return h.redirect(redirect).code(303).takeover()
        return h.view('report-issue/data/location', locationModel(request, request.payload, error.details)).code(400).takeover()
      }
    }
  },
  handler (request, h) {
    const redirect = guard(request)
    if (redirect) return h.redirect(redirect).code(303)
    request.yar.set('issueLocation', request.payload)
    return h.redirect(nextPage(request, '/report-issue/data/attributes')).code(303)
  }
}

const attributesQuestion = 'Which attributes are incorrect?'
const attributesMessage = 'Select which attributes are incorrect'
export const attributeOptions = [
  { value: 'land-cover', text: 'Land cover' },
  { value: 'land-use', text: 'Land use' },
  { value: 'ownership', text: 'Ownership' },
  { value: 'soils', text: 'Soils' },
  { value: 'protected-areas', text: 'Protected areas' },
  { value: 'hydrology', text: 'Hydrology' },
  { value: 'topography', text: 'Topography' }
]
const attributesSchema = Joi.array().items(Joi.string().valid(...attributeOptions.map(({ value }) => value)))
  .min(1).unique().single().required()

function attributesModel (request, attributes, invalid = false) {
  const values = Array.isArray(attributes) ? attributes : [attributes]
  return {
    ...getChangeNavigation(request, '/report-issue/data/attributes', '/report-issue/data/location'),
    ...errors(attributesQuestion, invalid ? [{ text: attributesMessage, href: '#attributes' }] : []),
    attributeOptions,
    attributes: values.filter(value => attributeOptions.some(option => option.value === value)),
    attributesError: invalid ? { text: attributesMessage } : undefined
  }
}

export function getAttributesRedirect (request) {
  return guard(request) || (locationSchema.validate(request.yar.get('issueLocation') ?? {}).error
    ? '/report-issue/data/location'
    : undefined)
}

export function getDataDescriptionRedirect (request) {
  return getAttributesRedirect(request) || (attributesSchema.validate(request.yar.get('incorrectAttributes')).error
    ? '/report-issue/data/attributes'
    : undefined)
}

export const attributesController = {
  handler (request, h) {
    const redirect = getAttributesRedirect(request)
    if (redirect) return h.redirect(redirect).code(303)
    return h.view('report-issue/data/attributes', attributesModel(request, request.yar.get('incorrectAttributes')))
  }
}

export const attributesPostController = {
  options: {
    validate: {
      payload: Joi.object({ attributes: attributesSchema }).options({ stripUnknown: true }),
      failAction (request, h) {
        const redirect = getAttributesRedirect(request)
        if (redirect) return h.redirect(redirect).code(303).takeover()
        return h.view('report-issue/data/attributes', attributesModel(request, request.payload.attributes, true)).code(400).takeover()
      }
    }
  },
  handler (request, h) {
    const redirect = getAttributesRedirect(request)
    if (redirect) return h.redirect(redirect).code(303)
    request.yar.set('incorrectAttributes', request.payload.attributes)
    return h.redirect(nextPage(request, '/report-issue/description')).code(303)
  }
}
