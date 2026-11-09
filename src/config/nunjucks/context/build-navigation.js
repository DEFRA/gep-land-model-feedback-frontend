export function buildNavigation (request) {
  return [
    {
      text: 'Home',
      href: '/',
      current: request?.path === '/'
    }
  ]
}
