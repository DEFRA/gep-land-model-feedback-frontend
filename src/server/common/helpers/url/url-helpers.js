import escapeHtml from 'lodash/escape.js'

/**
 * Sets the host, protocol and port of a URL to use the external address.
 * @param {string|URL} url
 * @param {string|URL} external
 * @returns {URL}
 */
export function asExternalUrl (url, external) {
  const currentUrl = new URL(url)
  const externalUrl = new URL(external)
  currentUrl.protocol = externalUrl.protocol
  currentUrl.hostname = externalUrl.hostname
  currentUrl.port = externalUrl.port

  return currentUrl
}

/**
 * Borrowed from hapi/bell.
 * Workaround for some browsers where due to CORS and the redirection method, the state
 * cookie is not included with the request unless the request comes directly from the same origin.
 */
export const redirectWithRefresh = (h, redirect) => {
  return h
    .response(
      `<html><head><meta http-equiv="refresh" content="0;URL='${escapeHtml(redirect)}'"></head><body></body></html>`
    )
    .takeover()
}
