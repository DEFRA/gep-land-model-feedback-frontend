/** Write download diagnostics in both structured logs and the console message. */
export function logDownload (request, message, details, level = 'info') {
  const evidenceDownload = { ...request.params, ...details }
  request.logger[level]({ evidenceDownload }, message)
  // As with OIDC, preserve diagnostics in hosting viewers that drop custom fields.
  console[level](`${message}: ${JSON.stringify(evidenceDownload)}`)
}
