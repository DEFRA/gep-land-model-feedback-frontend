import Blankie from 'blankie'

import { config } from '../../../config/config.js'

const gtmContainerId = config.get('googleTagManager.containerId')

const GA_DOMAIN = 'https://www.google-analytics.com'
const GTM_DOMAIN = 'https://www.googletagmanager.com'

const gtmScriptSrc = gtmContainerId ? [GTM_DOMAIN, GA_DOMAIN] : []
const gtmConnectSrc = gtmContainerId
  ? [GA_DOMAIN, 'https://analytics.google.com', 'https://region1.google-analytics.com']
  : []
const gtmImgSrc = gtmContainerId ? [GA_DOMAIN, GTM_DOMAIN] : []
const gtmFrameSrc = gtmContainerId ? [GTM_DOMAIN] : []

/**
 * Manage content security policies.
 * @satisfies {import('@hapi/hapi').Plugin}
 */
const contentSecurityPolicy = {
  plugin: Blankie,
  options: {
    defaultSrc: ['self'],
    fontSrc: ['self'],
    connectSrc: ['self', ...gtmConnectSrc],
    mediaSrc: ['self'],
    styleSrc: ['self'],
    scriptSrc: ['self', ...gtmScriptSrc],
    imgSrc: ['self', ...gtmImgSrc],
    frameSrc: ['self', ...gtmFrameSrc],
    objectSrc: ['none'],
    frameAncestors: ['none'],
    formAction: ['self'],
    manifestSrc: ['self'],
    // https://frontend.design-system.service.gov.uk/import-javascript/#use-a-nonce-attribute-to-unblock-inline-javascript
    generateNonces: true
  }
}

export { contentSecurityPolicy }
