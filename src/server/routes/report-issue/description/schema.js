import Joi from 'joi'

export const descriptionSchema = Joi.string().trim().max(2000).required()

export function createDescriptionPayloadSchema (otherDataset) {
  return Joi.object({
    issueWhere: otherDataset ? Joi.string().trim().required() : Joi.any().strip(),
    issueDescription: descriptionSchema
  }).required()
}
