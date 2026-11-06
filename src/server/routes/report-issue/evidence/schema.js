import Joi from 'joi'

export const fileSchema = Joi.object({
  fileId: Joi.string().uuid().required(),
  filename: Joi.string().required(),
  contentLength: Joi.number().integer().positive().required(),
  s3Bucket: Joi.string().required(),
  s3Key: Joi.string().required(),
  contentType: Joi.string().optional(),
  checksumSha256: Joi.string().optional()
}).options({ stripUnknown: true })
