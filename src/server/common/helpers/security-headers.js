/**
 * Set additional HTTP security headers recommended by OWASP.
 * https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html
 *
 * Headers managed by Hapi's routes.security (hsts, xframe, xss, noSniff,
 * referrer) are configured in server.js. This plugin covers the remaining
 * headers that Hapi does not support natively.
 * @satisfies {import('@hapi/hapi').Plugin}
 */
const securityHeaders = {
  plugin: {
    name: 'security-headers',
    register (server) {
      server.ext('onPreResponse', (request, h) => {
        const { response } = request

        const headers = {
          'permissions-policy':
            'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
          'cross-origin-opener-policy': 'same-origin',
          'cross-origin-resource-policy': 'same-site',
          'cross-origin-embedder-policy': 'require-corp',
          'x-permitted-cross-domain-policies': 'none'
        }

        if (response.isBoom) {
          for (const [key, value] of Object.entries(headers)) {
            response.output.headers[key] = value
          }
        } else {
          for (const [key, value] of Object.entries(headers)) {
            response.headers[key] = value
          }
        }

        return h.continue
      })
    }
  }
}

export { securityHeaders }
