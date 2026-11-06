export const checkAnswersPath = '/report-issue/check-your-answers'

// Only support this fixed destination, never a user-supplied redirect URL.
export function getChangeNavigation (request, formAction, backLink) {
  const changing = request.query.returnTo === 'check-your-answers'
  return {
    formAction: changing ? `${formAction}?returnTo=check-your-answers` : formAction,
    backLink: changing ? checkAnswersPath : backLink
  }
}

export function nextPage (request, defaultPath) {
  return request.query.returnTo === 'check-your-answers' ? checkAnswersPath : defaultPath
}
