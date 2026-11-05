import { ecsFormat } from '@elastic/ecs-pino-format'
import { getTraceId } from '@defra/hapi-tracing'

import { config } from '../../../../config/config.js'
import { statusCodes } from '../../constants/status-codes.js'

const logConfig = config.get('log')
const serviceName = config.get('serviceName')
const serviceVersion = config.get('serviceVersion')

const formatters = {
  ecs: {
    ...ecsFormat({
      serviceVersion,
      serviceName
    })
  },
  'pino-pretty': {
    transport: {
      target: 'pino-pretty',
      options: { ignore: 'responseTime' }
    },
    serializers: {
      req: (req) => {
        if (req.response?.statusCode >= statusCodes.internalServerError) {
          return {
            method: req.method,
            url: req.url,
            query: req.query,
            headers: req.headers
          }
        }
        return undefined
      },
      res: (res) => {
        if (res.statusCode >= statusCodes.internalServerError) {
          return {
            statusCode: res.statusCode,
            headers: res.getHeaders?.()
          }
        }
        return undefined
      }
    },
    customRequestCompleteMessage: (request, responseTime) => {
      return `${request.method.toUpperCase()} ${request.path} ${request.response.statusCode} (${responseTime}ms)`
    }
  }
}

export const loggerOptions = {
  enabled: logConfig.enabled,
  ignorePaths: ['/health', '/favicon.ico'],
  ignoreTags: ['asset'],
  redact: {
    paths: logConfig.redact,
    remove: true
  },
  level: logConfig.level,
  ...formatters[logConfig.format],
  nesting: true,
  mixin () {
    const mixinValues = {}
    const traceId = getTraceId()
    if (traceId) {
      mixinValues.trace = { id: traceId }
    }
    return mixinValues
  }
}
