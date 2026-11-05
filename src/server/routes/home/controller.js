import Joi from 'joi'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const question = 'What type of issue is being reported?'
const selectionError = 'Select what type of issue is being reported'
const issueTypes = [
  {
    value: 'data',
    text: 'Data issue',
    hint: { text: 'For example, a feature showing incorrect land cover' }
  },
  {
    value: 'technical',
    text: 'Technical issue',
    hint: { text: 'For example, a dataset download not working' }
  }
]

function pageModel (issueType, hasError = false) {
  return {
    pageTitle: `${hasError ? 'Error: ' : ''}${question}`,
    radios: {
      name: 'issueType',
      idPrefix: 'issue-type',
      value: issueType,
      fieldset: {
        legend: {
          text: question,
          isPageHeading: true,
          classes: 'govuk-fieldset__legend--l'
        }
      },
      items: issueTypes,
      errorMessage: hasError ? { text: selectionError } : undefined
    },
    errorSummary: hasError
      ? {
          titleText: 'There is a problem',
          errorList: [{ text: selectionError, href: '#issue-type' }]
        }
      : undefined
  }
}

export const homeController = {
  handler (request, h) {
    return h.view('home/index', pageModel(request.yar.get('issueType')))
  }
}

export const issueTypeController = {
  options: {
    validate: {
      payload: Joi.object({
        issueType: Joi.string().valid(...issueTypes.map(({ value }) => value)).required()
      }).options({ stripUnknown: true }),
      failAction (request, h) {
        return h
          .view('home/index', pageModel(request.payload?.issueType, true))
          .code(statusCodes.badRequest)
          .takeover()
      }
    }
  },
  handler (request, h) {
    request.yar.set('issueType', request.payload.issueType)
    return h.redirect(`/report-issue/${request.payload.issueType}`).code(303)
  }
}
