import Joi from 'joi'

import { locationOptions, attributeOptions } from './constants.js'

const GRID_PREFIX_LENGTH = 2

const locationQuestion = 'Enter the location of the issue'
const gridReferencePattern = /^[HNOTS][A-HJ-Z](?:\s*(?:\d{2}){1,5}|\s*\d{1,5}\s+\d{1,5})?$/i
const featureReferencePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function referenceSchema (pattern, missing, invalid) {
  return Joi.string().trim().pattern(pattern).required().messages({
    'any.required': missing,
    'string.empty': missing,
    'string.base': invalid,
    'string.pattern.base': invalid
  })
}
const locationInputs = {
  gridReference: referenceSchema(gridReferencePattern, 'Enter a grid cell reference', 'Enter the grid cell reference in British National Grid format').custom(validateGridPrecision),
  featureReference: referenceSchema(featureReferencePattern, 'Enter a feature reference', 'Enter the feature reference in OSID format'),
  locationDescription: Joi.string().trim().required().messages({
    'any.required': locationQuestion,
    'string.empty': locationQuestion,
    'string.base': locationQuestion
  })
}

const locationFields = Object.fromEntries(locationOptions.map(({ name, value }) => [name, Joi.when('locationType', {
  is: value,
  then: locationInputs[name],
  otherwise: Joi.any().strip()
})]))
export const locationSchema = Joi.object({
  locationType: Joi.string().valid(...locationOptions.map(({ value }) => value)).required(),
  ...locationFields
}).options({ stripUnknown: true })

export const attributesSchema = Joi.array().items(Joi.string().valid(...attributeOptions.map(({ value }) => value)))
  .min(1).unique().single().required()

export const datasetSchema = Joi.object({
  dataset: Joi.string().valid('land-model', 'other').required(),
  datasetOtherId: Joi.when('dataset', { is: 'other', then: Joi.string().required(), otherwise: Joi.any().strip() })
}).options({ stripUnknown: true })

export const attributesPayloadSchema = Joi.object({ attributes: attributesSchema }).options({ stripUnknown: true })

function validateGridPrecision (value, helpers) {
  const [easting, northing] = value.slice(GRID_PREFIX_LENGTH).trim().split(/\s+/)
  if (northing && easting.length !== northing.length) {
    return helpers.error('string.pattern.base')
  }
  return value
}
