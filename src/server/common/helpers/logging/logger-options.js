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
      // Apply our safe error serializer before any ECS error conversion.
      convertErr: false,
      serviceVersion,
      serviceName
    })
  },
  'pino-pretty': {
    transport: {
      target: 'pino-pretty',
      options: { ignore: 'responseTime' }
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
  customRequestErrorMessage: () => 'Request failed',
  hooks: {
    logMethod (args, method) {
      // Pino derives its message from an Error before applying serializers.
      if (args[0] instanceof Error || args[0]?.err) {
        const context = args[0] instanceof Error ? {} : args[0]
        return method.call(this, { ...context, err: { message: 'Operation failed' } }, 'Operation failed')
      }
      return method.apply(this, args)
    }
  },
  serializers: {
    // SDK errors may carry tokens in messages, stacks, headers and nested causes.
    err: () => ({ message: 'Operation failed' }),
    req (req) {
      if (req.response?.statusCode >= statusCodes.internalServerError) {
        return {
          method: req.method,
          path: req.path ?? (typeof req.url === 'string' ? req.url.split('?')[0] : req.url?.pathname)
        }
      }
    },
    res (res) {
      if (res.statusCode >= statusCodes.internalServerError) return { statusCode: res.statusCode }
    }
  },
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
