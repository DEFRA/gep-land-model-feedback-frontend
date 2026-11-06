import { load } from 'cheerio'

import { mockAuthCredentials } from './auth.js'

/** Keep cookies and CSRF handling consistent across workflow integration tests. */
export function createJourneyClient (server) {
  const cookies = new Map()

  async function visit (url, payload, auth = mockAuthCredentials) {
    const response = await server.inject({
      url,
      method: payload === undefined ? 'GET' : 'POST',
      auth,
      headers: { cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; ') },
      payload
    })
    for (const cookie of response.headers['set-cookie'] ?? []) {
      const [name, ...value] = cookie.split(';')[0].split('=')
      cookies.set(name, value.join('='))
    }
    return response
  }

  async function submit (url, fields = {}, csrfPage = url) {
    const page = await visit(csrfPage)
    const crumb = load(page.payload)('input[name="crumb"]').val()
    return visit(url, { crumb, ...fields })
  }

  return { visit, submit }
}
