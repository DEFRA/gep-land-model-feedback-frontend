import Joi from 'joi'

const MAX_DESCRIPTION_LENGTH = 2000

export const descriptionSchema = Joi.string().trim().max(MAX_DESCRIPTION_LENGTH).required()

export function createDescriptionPayloadSchema (otherDataset) {
  return Joi.object({
    issueWhere: otherDataset ? Joi.string().trim().required() : Joi.any().strip(),
    issueDescription: descriptionSchema
  }).required()
}
