import { locationSchema, attributesSchema } from '../data/schema.js'
import { descriptionSchema } from '../description/schema.js'
import { allowedAreas } from '../technical/constants.js'

export function isTechnicalIssue (request) {
  return request.yar.get('issueType') === 'technical'
}

export function isOtherDataset (request) {
  return request.yar.get('issueType') === 'data' && request.yar.get('dataset') === 'other'
}

export function getLocationRedirect (request) {
  if (request.yar.get('issueType') !== 'data') {
    return '/'
  }
  if (request.yar.get('dataset') !== 'land-model') {
    return '/report-issue/data'
  }
  return undefined
}

export function getAttributesRedirect (request) {
  const redirect = getLocationRedirect(request)
  if (redirect) {
    return redirect
  }
  if (locationSchema.validate(request.yar.get('issueLocation') ?? {}).error) {
    return '/report-issue/data/location'
  }
  return undefined
}

function getDataDescriptionRedirect (request) {
  if (isOtherDataset(request)) {
    const hasDataset = request.yar.get('datasetOtherId') && request.yar.get('datasetOtherTitle')
    return hasDataset ? undefined : '/report-issue/data'
  }
  const redirect = getAttributesRedirect(request)
  if (redirect) {
    return redirect
  }
  if (attributesSchema.validate(request.yar.get('incorrectAttributes')).error) {
    return '/report-issue/data/attributes'
  }
  return undefined
}

function getTechnicalDescriptionRedirect (request) {
  const area = request.yar.get('technicalArea')
  if (!allowedAreas.includes(area) || (area === 'other' && !request.yar.get('technicalOther'))) {
    return '/report-issue/technical'
  }
  return undefined
}

export function getDescriptionRedirect (request) {
  const issueType = request.yar.get('issueType')
  if (issueType === 'data') {
    return getDataDescriptionRedirect(request)
  }
  if (issueType === 'technical') {
    return getTechnicalDescriptionRedirect(request)
  }
  return '/'
}

export function getEvidenceRedirect (request) {
  const redirect = getDescriptionRedirect(request)
  if (redirect) {
    return redirect
  }
  const invalidDescription = descriptionSchema.validate(request.yar.get('issueDescription')).error
  const missingLocation = isOtherDataset(request) && !request.yar.get('issueWhere')
  if (invalidDescription || missingLocation) {
    return '/report-issue/description'
  }
  return undefined
}
