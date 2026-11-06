export function buildFormPage (question, errorList) {
  return {
    question,
    pageTitle: `${errorList.length ? 'Error: ' : ''}${question}`,
    errorSummary: errorList.length ? { titleText: 'There is a problem', errorList } : undefined
  }
}
