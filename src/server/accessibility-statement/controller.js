const pageTitle = 'Accessibility statement'

export const accessibilityStatementController = {
  handler (_request, h) {
    return h.view('accessibility-statement/index', {
      pageTitle,
      heading: pageTitle,
      breadcrumbs: [
        {
          text: 'Home',
          href: '/'
        },
        {
          text: pageTitle
        }
      ]
    })
  }
}
