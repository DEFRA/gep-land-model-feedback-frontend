export const privacyController = {
  handler (_request, h) {
    return h.view('privacy/index', {
      pageTitle: 'Privacy',
      heading: 'Privacy',
      breadcrumbs: [
        {
          text: 'Home',
          href: '/'
        },
        {
          text: 'Privacy'
        }
      ]
    })
  }
}
