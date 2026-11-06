# Development guidance

## Code organisation and standards

Inherited CDP template files retain their existing locations and structure.
The page and service reorganisation below applies to the application code added
for issue reporting. Template updates remain limited to configuration, runtime
and build settings, or targeted fixes needed by the application.

The workflow follows the page modules used in
[Find Geo Data](https://github.com/DEFRA/gep-find-geo-data-frontend/tree/develop/src/server/search)
and [Land Model Viewer](https://github.com/DEFRA/gep-land-model-viewer-frontend/tree/develop/src/server):

- `src/server/routes/report-issue/index.js` registers each page's Hapi plugin.
- Page folders own their route registration (`index.js`), controllers, templates
  and integration tests. Larger pages keep Joi schemas, view models and service
  logic in separate modules. Data issue controllers are split by dataset,
  location and attributes within the same feature folder.
- `helpers/prerequisites.js` checks workflow prerequisites without importing
  controllers. `helpers/answers.js` creates the shared answer snapshot;
  `check-your-answers/view-model.js` formats it for both review and email.
- `src/server/common/services/` contains the GeoNetwork, CDP Uploader and Notify
  clients. External request construction, timeouts and retry policy live here;
  page controllers handle navigation, session updates and rendering.
- `src/config/formats.js` defines reusable configuration validation formats.
- `src/server/common/test-helpers/journey-client.js` handles session cookies and
  CSRF tokens for workflow integration tests.

Follow the [Defra Node.js standards](https://defra.github.io/software-development-standards/standards/node_standards/)
and [JavaScript standards](https://defra.github.io/software-development-standards/standards/javascript_standards/):
use Hapi, ES modules, async/await, neostandard and GOV.UK Frontend components.
ESLint also requires braces around control-flow bodies, consistent returns, and
named constants for production magic numbers. Numeric test fixtures and array
indexes are allowed. The runtime is pinned to Node 26 Active LTS in `.nvmrc`,
`package.json` and the Defra Docker images; use `nvm install && nvm use` after
updating your checkout. Dependencies are pinned and automated installs use `npm ci`
with the repository's `.npmrc` settings. Docker builds copy those settings before
installing dependencies. Run lint, tests with coverage, the frontend build and
`npm run security-audit` before raising a pull request.

Yar stores workflow state in the configured cache rather than in cookies.
Production requires Redis and rejects a process-local memory cache. Memory remains
available for local development and offline tests. Authentication defaults to on;
set `AUTH_REQUIRED=false` in your local environment to bypass it on loopback only.


## Application behaviour

Both data and technical issue journeys use GOV.UK Frontend components. The routes
live under `/report-issue`; the initial issue-type question is the home page.
Keep page validation on the server and preserve CSRF protection when adding forms.
Application POST forms include the hidden `crumb` token. The multipart form sent
directly to CDP Uploader uses its single-use upload URL instead.

Authentication uses OIDC authorization code with PKCE, following the Land Model
Viewer implementation. Sessions and refresh tokens are held in the configured
cache. Deployed environments use Cognito; local development uses Keycloak with
the imported realm in `compose/keycloak`.

Evidence goes directly to CDP Uploader. The frontend waits for completed scans,
validates the result's session token, bucket and batch path, and stores only file
metadata in the session. Removing an attachment removes its report reference,
not the S3 object. Configure storage retention separately for deployments.

Submission sends the answer snapshot to GOV.UK Notify before showing confirmation.
Reports remain session-scoped; there is no durable report store or external case
system. File-download links in emails are placeholders.

## External API logging

All server-side external API operations use `logExternalCall` in the existing
logging helper. This covers GeoNetwork searches (each page), CDP Uploader
initiation and status checks, each Notify send attempt, OIDC discovery, code
exchange and token refresh, and Cognito identity token requests. Cached discovery
metadata and cached tokens do not produce external-call logs.

At `LOG_LEVEL=info`, each call emits an outcome summary with `service`,
`operation`, `durationMs`, `outcome` and a numeric `statusCode` when available.
HTTP 4xx/5xx responses are failures even when the HTTP client resolves normally.
Rejected network/SDK calls are also failures and retain their original errors
for the caller. A completed HTTP call means a response was received; it does not
mean that later body parsing or business validation succeeded.

Set `LOG_LEVEL=debug` to also see call-start and completion/failure events.
The configured Pino logger supplies the existing trace context. Logs exclude
request/response bodies, URLs, headers, credentials, tokens and raw SDK error
objects. Authentication error handlers use fixed messages for the same reason.
`LOG_ENABLED=false` disables logging. Restart the app after changing these values.

When adding a new external API operation, wrap the actual asynchronous call with
`logExternalCall`, using fixed service and operation names. Do not pass URLs,
user input or payloads as those names. Keep retries inside the wrapper's caller
so every attempt is logged separately.

## Checks and delivery

Run the checks listed in the [README](../README.md#development) before submitting
a pull request. Tests mock external HTTP calls and do not need Docker or real
Notify credentials. Workflow integration tests cover validation, navigation,
authentication, uploads and submission recovery.

CI runs tests, lint, the frontend build, dependency auditing, a Docker build and
SonarCloud analysis. Dependabot checks dependency updates. Dependencies are pinned;
review upgrades before changing `package.json` and `package-lock.json` together.

The [Dockerfile](../Dockerfile) retains the CDP development, build and production
stages. Build and run a production image with deployment-specific settings for
Redis, OIDC/Cognito, GeoNetwork, CDP Uploader and Notify. Local Compose credentials
and simulated scanning are for development.
