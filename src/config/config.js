import convict from 'convict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import convictFormatWithValidator from 'convict-format-with-validator'
import { registerConfigFormats } from './formats.js'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const developmentPort = 3004
const productionPort = 3000
const developmentRedisPort = 6382
const defaultRedisPort = 6379
const oneYearMs = 31536000000

const eightHoursMs = 28800000
const oneDayMs = 86400000
const oneWeekMs = 604800000

const isProduction = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'
const isDevelopment = process.env.NODE_ENV === 'development'

convict.addFormats(convictFormatWithValidator)
registerConfigFormats(convict)

export const config = convict({
  serviceVersion: {
    doc: 'The service version, this variable is injected into your docker container in CDP environments',
    format: String,
    nullable: true,
    default: null,
    env: 'SERVICE_VERSION'
  },
  host: {
    doc: 'The IP address to bind',
    format: 'ipaddress',
    default: '0.0.0.0',
    env: 'HOST'
  },
  port: {
    doc: 'The port to bind.',
    format: 'port',
    default: isDevelopment ? developmentPort : productionPort,
    env: 'PORT'
  },
  staticCacheTimeout: {
    doc: 'Static cache timeout in milliseconds',
    format: Number,
    default: oneWeekMs,
    env: 'STATIC_CACHE_TIMEOUT'
  },
  serviceName: {
    doc: 'Applications Service Name',
    format: String,
    default: 'gep-land-model-feedback-frontend'
  },
  serviceDisplayName: {
    doc: 'Human-readable service name shown in the UI',
    format: String,
    default: 'Defra Group Land Model Issue Reporting'
  },
  supportMailboxAddress: {
    doc: 'Destination mailbox for issue report emails, shown on the Issue reported page',
    format: 'email',
    nullable: true,
    default: 'example@example.com',
    env: 'SUPPORT_MAILBOX_ADDRESS'
  },
  notify: {
    apiKey: {
      doc: 'GOV.UK Notify API key for sending issue report emails',
      format: String,
      sensitive: true,
      default: '',
      env: 'GOV_UK_NOTIFY_API_KEY'
    },
    templateId: {
      doc: 'GOV.UK Notify email template ID; required when submitting an issue',
      format: 'optional-uuid',
      default: '',
      env: 'GOV_UK_NOTIFY_TEMPLATE_ID'
    },
    emailSubject: {
      doc: 'Issue report email subject prefix; the reference number is appended',
      format: 'email-subject',
      default: 'ATLAS issue report',
      env: 'GOV_UK_NOTIFY_EMAIL_SUBJECT'
    }
  },
  root: {
    doc: 'Project root',
    format: String,
    default: path.resolve(dirname, '../..')
  },
  assetPath: {
    doc: 'Asset path',
    format: String,
    default: '/public',
    env: 'ASSET_PATH'
  },
  isProduction: {
    doc: 'If this application running in the production environment',
    format: Boolean,
    default: isProduction
  },
  isDevelopment: {
    doc: 'If this application running in the development environment',
    format: Boolean,
    default: isDevelopment
  },
  isTest: {
    doc: 'If this application running in the test environment',
    format: Boolean,
    default: isTest
  },
  appBaseUrl: {
    doc: 'Application base URL',
    format: String,
    default: 'http://localhost:3004',
    env: 'APP_BASE_URL'
  },
  log: {
    enabled: {
      doc: 'Is logging enabled',
      format: Boolean,
      default: process.env.NODE_ENV !== 'test',
      env: 'LOG_ENABLED'
    },
    level: {
      doc: 'Logging level',
      format: ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'],
      default: 'info',
      env: 'LOG_LEVEL'
    },
    format: {
      doc: 'Format to output logs in.',
      format: ['ecs', 'pino-pretty'],
      default: isProduction ? 'ecs' : 'pino-pretty',
      env: 'LOG_FORMAT'
    },
    redact: {
      doc: 'Log paths to redact',
      format: Array,
      default: isProduction
        ? ['req.headers.authorization', 'req.headers.cookie', 'res.headers']
        : [],
      env: 'LOG_REDACT'
    }
  },
  httpProxy: {
    doc: 'HTTP Proxy',
    format: String,
    nullable: true,
    default: null,
    env: 'HTTP_PROXY'
  },
  isSecureContextEnabled: {
    doc: 'Enable Secure Context',
    format: Boolean,
    default: isProduction,
    env: 'ENABLE_SECURE_CONTEXT'
  },
  session: {
    cache: {
      engine: {
        doc: 'backend cache is written to',
        format: ['redis', 'memory'],
        default: isTest ? 'memory' : 'redis',
        env: 'SESSION_CACHE_ENGINE'
      },
      name: {
        doc: 'Server-side session cache name, also used for the Yar session cookie',
        format: String,
        default: isDevelopment ? 'landModelFeedbackSessionCookie' : 'session',
        env: 'SESSION_CACHE_NAME'
      },
      ttl: {
        doc: 'server side session cache ttl',
        format: Number,
        default: oneDayMs,
        env: 'SESSION_CACHE_TTL'
      },
      segment: {
        doc: 'Isolate cached items within the cache partition',
        format: String,
        default: 'session',
        env: 'SESSION_CACHE_SEGMENT'
      }
    },
    cookie: {
      name: {
        doc: 'Login cookie name. Use distinct names for apps sharing a hostname.',
        format: String,
        default: isDevelopment ? 'landModelFeedbackUserSessionCookie' : 'userSessionCookie',
        env: 'SESSION_COOKIE_NAME'
      },
      ttl: {
        doc: 'Session cookie ttl',
        format: Number,
        default: eightHoursMs,
        env: 'SESSION_COOKIE_TTL'
      },
      password: {
        doc: 'session cookie password',
        format: String,
        default: 'the-password-must-be-at-least-32-characters-long',
        env: 'SESSION_COOKIE_PASSWORD',
        sensitive: true
      },
      secure: {
        doc: 'set secure flag on cookie',
        format: Boolean,
        default: isProduction,
        env: 'SESSION_COOKIE_SECURE'
      }
    }
  },
  redis: {
    port: {
      doc: 'Redis cache port',
      format: 'port',
      default: isDevelopment ? developmentRedisPort : defaultRedisPort,
      env: 'REDIS_PORT'
    },
    host: {
      doc: 'Redis cache host',
      format: String,
      default: '127.0.0.1',
      env: 'REDIS_HOST'
    },
    username: {
      doc: 'Redis cache username',
      format: String,
      default: '',
      env: 'REDIS_USERNAME'
    },
    password: {
      doc: 'Redis cache password',
      format: '*',
      default: '',
      sensitive: true,
      env: 'REDIS_PASSWORD'
    },
    keyPrefix: {
      doc: 'Redis cache key prefix name used to isolate the cached results across multiple clients',
      format: String,
      default: 'gep-land-model-feedback-frontend:',
      env: 'REDIS_KEY_PREFIX'
    },
    useSingleInstanceCache: {
      doc: 'Connect to a single instance of redis instead of a cluster.',
      format: Boolean,
      default: !isProduction,
      env: 'USE_SINGLE_INSTANCE_CACHE'
    },
    useTLS: {
      doc: 'Connect to redis using TLS',
      format: Boolean,
      default: isProduction,
      env: 'REDIS_TLS'
    }
  },
  auth: {
    required: {
      doc: 'Require authentication; false bypasses sign-in and skips Cognito/OIDC setup in all environments',
      format: Boolean,
      default: true,
      env: 'AUTH_REQUIRED'
    }
  },
  oidc: {
    clientId: {
      doc: 'OIDC client ID',
      format: String,
      env: 'OIDC_CLIENT_ID',
      default: 'd02ee02c-b8da-483d-8a4e-29de7db48b03'
    },
    clientSecret: {
      doc: 'OIDC client secret, shared between mock credential provider and local Keycloak. Not used in deployed environments.',
      format: String,
      sensitive: true,
      env: 'OIDC_CLIENT_SECRET',
      default: 'local-dev-secret'
    },
    wellKnownConfigurationUrl: {
      doc: 'OIDC .well-known configuration URL',
      format: String,
      env: 'OIDC_WELL_KNOWN_CONFIGURATION_URL',
      // A product-specific Keycloak path keeps its cookies separate from other local apps.
      default: 'http://localhost:8084/land-model-feedback/realms/defra-local/.well-known/openid-configuration'
    },
  },
  cognito: {
    enabled: {
      doc: 'Use AWS Cognito for client assertions (false uses local JWT signer)',
      format: Boolean,
      default: false,
      env: 'COGNITO_ENABLED'
    },
    identityPoolId: {
      doc: 'AWS Cognito identity pool ID',
      format: String,
      env: 'COGNITO_IDENTITY_POOL_ID',
      nullable: true,
      default: null
    }
  },
  nunjucks: {
    watch: {
      doc: 'Reload templates when they are changed.',
      format: Boolean,
      default: isDevelopment
    },
    noCache: {
      doc: 'Use a cache and recompile templates each time',
      format: Boolean,
      default: isDevelopment
    }
  },
  tracing: {
    header: {
      doc: 'Which header to track',
      format: String,
      default: 'x-cdp-request-id',
      env: 'TRACING_HEADER'
    }
  },
  cookieConsent: {
    name: {
      doc: 'Name of cookie that stores the user consent preference',
      format: String,
      default: `${encodeURIComponent('gep-land-model-feedback-frontend')}_policy`
    },
    policy: {
      ignoreErrors: {
        doc: 'Ignore invalid cookie encodings and reset consent safely',
        format: Boolean,
        default: true
      },
      isHttpOnly: {
        doc: 'Only allow the server to read the consent policy cookie',
        format: Boolean,
        default: true
      },
      path: {
        doc: 'Apply the consent policy to every service route',
        format: String,
        default: '/'
      },
      clearInvalid: {
        doc: 'Clear the cookie if it fails validation (e.g. bad JSON)',
        format: Boolean,
        default: true
      },
      encoding: {
        doc: 'Hapi cookie encoding — base64json automatically serialises objects',
        format: String,
        default: 'base64json'
      },
      isSameSite: {
        doc: 'SameSite attribute — Lax allows the cookie on top-level navigations',
        format: String,
        default: 'Lax'
      },
      isSecure: {
        doc: 'Secure flag — only send cookie over HTTPS in production',
        format: Boolean,
        default: isProduction
      }
    },
    config: {
      ttl: {
        doc: 'Cookie time-to-live in milliseconds (1 year)',
        format: 'nat',
        default: oneYearMs
      }
    }
  },
  uploader: {
    apiUrl: {
      doc: 'Internal CDP Uploader API base URL',
      format: 'url',
      default: 'http://localhost:7337',
      env: 'CDP_UPLOADER_URL'
    },
    publicUrl: {
      doc: 'Browser-facing uploader origin; empty uses the same-origin CDP upload route',
      format: 'http-origin-or-empty',
      default: isProduction ? '' : 'http://localhost:7337',
      env: 'CDP_UPLOADER_PUBLIC_URL'
    },
    bucket: {
      doc: 'CDP-approved destination bucket for clean issue evidence',
      format: String,
      default: 'atlas-feedback-evidence',
      env: 'EVIDENCE_S3_BUCKET'
    },
    maxFileSizeMB: {
      doc: 'Maximum evidence file size in megabytes (1 MB = 1,000,000 bytes)',
      format: 'positive-megabytes',
      default: 100,
      env: 'EVIDENCE_MAX_FILE_SIZE_MB'
    },
    excludedFileExtensions: {
      doc: 'Comma-separated filename extensions excluded from evidence uploads',
      format: 'file-extension-list',
      default: '.exe,.com,.bat,.cmd,.msi,.msp,.scr,.pif,.cpl,.dll,.ps1,.psm1,.vbs,.vbe,.js,.jse,.wsf,.wsh,.hta,.jar,.sh,.bash,.lnk,.reg,.docm,.dotm,.xlsm,.xltm,.xlam,.pptm,.potm,.ppam,.ppsm,.sldm'.split(','),
      env: 'EVIDENCE_EXCLUDED_FILE_EXTENSIONS'
    },
    allowedMimeTypes: {
      doc: 'Comma-separated allowed evidence MIME types; empty allows all types',
      format: 'mime-type-list',
      default: [],
      env: 'EVIDENCE_ALLOWED_MIME_TYPES'
    }
  },
  evidenceDownload: {
    allowAllUsers: {
      doc: 'Allow any authenticated user to download evidence without the AAD role; for development testing',
      format: Boolean,
      default: false,
      env: 'EVIDENCE_DOWNLOAD_ALLOW_ALL_USERS'
    },
    aadRole: {
      doc: 'Exact AAD app role required to download evidence unless allowAllUsers is enabled; empty denies role-based access',
      format: String,
      default: '',
      env: 'EVIDENCE_DOWNLOAD_AAD_ROLE'
    },
    s3Endpoint: {
      doc: 'S3 endpoint, matching the viewer; EVIDENCE_S3_ENDPOINT remains a fallback',
      format: String,
      default: process.env.EVIDENCE_S3_ENDPOINT || (isDevelopment ? 'http://localhost:4566' : ''),
      env: 'S3_ENDPOINT'
    },
    region: {
      doc: 'Evidence bucket region',
      format: String,
      default: 'eu-west-2',
      env: 'AWS_REGION'
    },
    accessKeyId: {
      doc: 'LocalStack access key; deployed services use the AWS credential provider chain',
      format: String,
      nullable: true,
      default: isDevelopment ? 'test' : null
    },
    secretAccessKey: {
      doc: 'LocalStack secret key; deployed services use the AWS credential provider chain',
      format: String,
      nullable: true,
      sensitive: true,
      default: isDevelopment ? 'test' : null
    }
  },
  geonetwork: {
    apiUrl: {
      doc: 'GeoNetwork REST API base URL',
      format: 'url',
      default: 'http://localhost:8080/geonetwork/srv/api',
      env: 'GEONETWORK_API_URL'
    },
    datasetCategories: {
      doc: 'Comma-separated catalogue category names; include matches from any, or leave empty for all categories',
      format: Array,
      default: [],
      env: 'GEONETWORK_DATASET_CATEGORIES'
    }
  },
  googleAnalytics: {
    googleTagManagerKey: {
      doc: 'Google Tag Manager container ID (e.g. GTM-XXXXXXXX)',
      format: String,
      default: '',
      env: 'GOOGLE_TAG_MANAGER_KEY'
    }
  }
})

config.validate({ allowed: 'strict' })
