import Joi from 'joi'

import { allowedAreas } from './constants.js'

export const technicalSchema = Joi.object({
  technicalArea: Joi.string().valid(...allowedAreas).required(),
  technicalOther: Joi.when('technicalArea', {
    is: 'other',
    then: Joi.string().trim().required(),
    otherwise: Joi.any().strip()
  })
}).options({ stripUnknown: true })
