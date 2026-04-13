import path from 'node:path'
import { readFileSync } from 'node:fs'

import { config } from '../../config.js'
import { buildNavigation } from './build-navigation.js'
import { createLogger } from '../../../server/common/helpers/logging/logger.js'

const logger = createLogger()
const assetPath = config.get('assetPath')
const manifestPath = path.join(
  config.get('root'),
  '.public/assets-manifest.json'
)

let webpackManifest

function parseAnalyticsConsent (cookieValue) {
  try {
    return JSON.parse(decodeURIComponent(cookieValue || '')).analytics === true
  } catch {
    return false
  }
}

export function context (request) {
  if (!webpackManifest) {
    try {
      webpackManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    } catch (error) {
      logger.error(error, `Webpack ${path.basename(manifestPath)} not found`)
    }
  }

  const cookieConsentSet = Boolean(request.state?.defra_cookies_policy_set)
  const cookieAction = request.query?.cookieAction || null
  const hasAnalyticsConsent = parseAnalyticsConsent(
    request.state?.defra_cookies_policy
  )

  return {
    assetPath: `${assetPath}/assets`,
    serviceName: config.get('serviceName'),
    serviceUrl: '/',
    breadcrumbs: [],
    navigation: buildNavigation(request),
    cspNonce: request.plugins?.blankie?.nonces?.script ?? null,
    gtmContainerId: config.get('googleTagManager.containerId'),
    cookieConsentSet,
    cookieAction,
    hasAnalyticsConsent,
    currentUrl: request.path,
    getAssetPath (asset) {
      const webpackAssetPath = webpackManifest?.[asset]
      return `${assetPath}/${webpackAssetPath ?? asset}`
    }
  }
}
