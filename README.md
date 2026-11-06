# gep-land-model-feedback-frontend

[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_gep-land-model-feedback-frontend&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=DEFRA_gep-land-model-feedback-frontend)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_gep-land-model-feedback-frontend&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=DEFRA_gep-land-model-feedback-frontend)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_gep-land-model-feedback-frontend&metric=coverage)](https://sonarcloud.io/summary/new_code?id=DEFRA_gep-land-model-feedback-frontend)

Core delivery platform Node.js Frontend Template.

- [Requirements](#requirements)
  - [Node.js](#nodejs)
- [Server-side Caching](#server-side-caching)
- [Redis](#redis)
- [Local Development](#local-development)
  - [Setup](#setup)
  - [Development](#development)
  - [Production](#production)
  - [Npm scripts](#npm-scripts)
  - [Update dependencies](#update-dependencies)
  - [Linting and Formatting](#linting-and-formatting)
  - [Testing](#testing)
  - [CI/CD](#cicd)
- [Issue reporting workflow](#issue-reporting-workflow)
- [GeoNetwork dataset catalogue](#geonetwork-dataset-catalogue)
- [Authentication](#authentication)
- [Docker](#docker)
  - [Development image](#development-image)
  - [Production image](#production-image)
  - [Docker Compose](#docker-compose)
  - [Dependabot](#dependabot)
  - [SonarCloud](#sonarcloud)
- [Branching Strategy](#branching-strategy)
- [Contributing](#contributing-to-this-project)
- [Licence](#licence)
  - [About the licence](#about-the-licence)

## Requirements

### Node.js

Please install [Node.js](http://nodejs.org/) `24.22.1` and [npm](https://nodejs.org/) `>= v10`. You will find it
easier to use the Node Version Manager [nvm](https://github.com/creationix/nvm)

To use the correct version of Node.js for this application, via nvm:

```bash
cd gep-land-model-feedback-frontend
nvm use
```

## Server-side Caching

We use Catbox for server-side caching. The service uses CatboxRedis when deployed and during local development, matching the viewer. Tests use CatboxMemory.
You can override the default behaviour by setting the `SESSION_CACHE_ENGINE` environment variable to either `redis` or
`memory`.

Please note: CatboxMemory (`memory`) is _not_ suitable for production use! The cache will not be shared between each
instance of the service and it will not persist between restarts.

## Redis

Redis is an in-memory key-value store. Every instance of a service has access to the same Redis key-value store similar
to how services might have a database (or MongoDB). All frontend services are given access to a namespaced prefixed that
matches the service name. e.g. `my-service` will have access to everything in Redis that is prefixed with `my-service`.

Authentication requires a session cache. Use `SESSION_CACHE_ENGINE=memory` only for local runs without Redis; sessions will be lost on restart.

## Proxy

We are using forward-proxy which is set up by default. Services are automatically configured with the proxy environment variables when deployed.

Node.js 24 uses these variables to route outbound HTTP(S) requests through the proxy:

NODE_USE_ENV_PROXY=1
HTTPS_PROXY=...
NO_PROXY=...

No additional proxy configuration is required in the service.

## Local Development

### Setup

Start the local authentication and session services, then install application dependencies:

```bash
docker compose up -d redis keycloak
npm ci
```

Copy `.env.example` to `.env` if you need to override local defaults.

### Git hooks

Dependency install scripts are disabled by `.npmrc`. Enable Git hooks explicitly with `npm run setup:husky`.

### Cookie consent and analytics

Set `GOOGLE_TAG_MANAGER_KEY` to your GTM container ID. This replaces `GTM_CONTAINER_ID`.
Consent is stored in `gep-land-model-feedback-frontend_policy` using the upstream format.
Existing users will be asked for consent again. Both the banner and preferences page submit
CSRF-protected requests to `/cookies`; the former `/cookies/accept` and `/cookies/reject`
endpoints have been replaced. Analytics only loads after consent, and rejecting analytics
removes GA cookies.

The optional cookie banner and analytics section on `/cookies` are only displayed when
`GOOGLE_TAG_MANAGER_KEY` is set. The cookies page always hides the banner. This matches
`DEFRA/gep-land-model-viewer-frontend` at `ac0c7b3441299715149d174e8a8ef21aec9fa349`.
Consent Mode defaults deny storage; analytics is granted and GTM loaded only after
the preference is saved. Advertising consent remains denied.

### Development

To run the application in `development` mode run:

```bash
npm run dev
```

Open `http://localhost:3004` and sign in with the local Keycloak user `dev` / `dev`.

Vite serves frontend assets through Hapi in development and writes hashed production assets to `.public` with `npm run build:frontend`.

### Production

To mimic the application running in `production` mode locally run:

```bash
npm start
```

### Npm scripts

All available Npm scripts can be seen in [package.json](./package.json)
To view them in your command line run:

```bash
npm run
```

### Update dependencies

To update dependencies use [npm-check-updates](https://github.com/raineorshine/npm-check-updates):

> The following script is a good start. Check out all the options on
> the [npm-check-updates](https://github.com/raineorshine/npm-check-updates)

```bash
ncu --interactive --format group
```

### Linting and Formatting

Code style and formatting are enforced by [neostandard](https://github.com/neostandard/neostandard) via ESLint, per the [Defra JavaScript coding standards](https://defra.github.io/software-development-standards/). SCSS is linted by StyleLint with the GDS config.

```bash
npm run lint          # Check for issues (read-only)
npm run format        # Auto-fix issues
```

If you are having issues with line break formatting on Windows, update your global git config:

```bash
git config --global core.autocrlf false
```

### Testing

Run the test suite with coverage:

```bash
npm test
```

To run a single test file:

```bash
npx vitest run path/to/file.test.js
```

Test coverage must meet 90% for lines, functions, statements and branches. This is enforced by the [vitest configuration](vitest.config.js).

### CI/CD

Pull requests to `develop` and `main` trigger the [Check Pull Request](.github/workflows/check-pull-request.yml) workflow which ensures the frontend builds, linting passes, tests run with coverage thresholds met, a security audit passes, and the Docker image builds successfully.

A [Gitflow PR target check](.github/workflows/gitflow-pr-target-check.yml) runs on all pull requests to ensure branches are targeting the correct base branch.

#### Build and deploy

Merges to `develop` trigger [Publish Develop](.github/workflows/publish-develop.yml) which patch-bumps a git tag (e.g. `0.3.1`, `0.3.2`) and builds a Docker image with that version. CDP auto-deploys these to the dev environment.

Pushes to a `release/*` branch trigger [Publish Release](.github/workflows/publish-release.yml) which builds a versioned Docker image (e.g. `0.2.0`), creates a git tag, updates `package.json`, and opens a draft PR to `main` with auto-generated release notes. Release branches must be named `release/X.Y` (e.g. `release/0.2`). The branch represents the minor version line - the workflow starts at `X.Y.0` and auto-increments the patch on each push. Deploy the release artifact to staging and production via the CDP portal, then mark the PR ready for review and merge once tested.

When a PR is merged into `main`, the [Auto Back-merge](.github/workflows/auto-back-merge.yml) workflow opens a PR to merge `main` back into `develop`. Review and merge it to keep develop up to date.

Hotfixes are handled by the [Publish Hot Fix](.github/workflows/publish-hotfix.yml) workflow, triggered manually from a hotfix branch. Each trigger builds a new patch version (e.g. `0.2.1`, `0.2.2`) so fixes can be re-tested before merging. Deploy hotfix artifacts via the CDP portal.

## Issue reporting workflow

The initial page at `/` asks **What type of issue is being reported?**, with Data
issue and Technical issue radio options and hints. All workflow controls use the
`govuk-frontend` Nunjucks macros; continue using these components for future pages.

Submitting an empty or invalid selection returns HTTP 400, prefixes the page title
with `Error:`, and displays the GOV.UK error summary and inline message:
**Select what type of issue is being reported**. The summary links to the first
radio input and its JavaScript enhancement focuses the summary automatically.

A valid POST stores `issueType` in the Yar session and redirects with HTTP 303 to
`/report-issue/data` or `/report-issue/technical`. The Back link returns to `/`
with the previous choice selected. Opening a branch without the matching choice
returns to the initial page. All pages require the existing authentication.

The branches use the questions and option labels based on the
[v2 prototype](https://gep-issue-reporting.prototypes.informed.com/v2/), using ATLAS terminology:

- Data issue: **Which dataset is the issue within?** — ATLAS Land Model / Other.
- Technical issue: **What does the technical issue relate to?** — ATLAS Map Viewer,
  ATLAS Data Search & Find, ATLAS Repository Integration, ATLAS data ingestion,
  ATLAS data export, or Other.

The Data issue page at `/report-issue/data` now accepts ATLAS Land Model and
continues to `/report-issue/data/location`. The dataset Other option remains
disabled; its future dropdown will use `listDatasets()` and the configured
`GEONETWORK_DATASET_CATEGORIES` filter.

**Enter the location of the issue** uses GOV.UK conditional radios for Grid cell,
Feature and Other, with the prototype's labels, hints and error messages. Continue
requires a location method and non-blank text for its selected input. Only that
input is saved, trimmed, in the Yar session as `issueLocation`; changing the method
clears the previous input. Back restores the saved answers. Grid cell and feature
references are required text for now; no catalogue or geographic lookup is performed.
A valid location continues to `/report-issue/data/attributes` for **Which attributes
are incorrect?**. The GOV.UK checkboxes offer Land cover, Land use, Ownership,
Soils, Protected areas, Hydrology and Topography with **Select all that apply**.
Continue requires at least one selection; empty or invalid submissions show
**Select which attributes are incorrect** in the error summary and inline error.
Selections are saved as `incorrectAttributes` in the Yar session and restored on
Back. Updating them replaces the previous choices. A valid selection redirects
to `/report-issue/description`, shared with the Technical issue workflow.

The Technical issue page is active at `/report-issue/technical`. Its GOV.UK radios reveal the **Enter what
the issue relates to** input when Other is selected. Continue requires a radio
selection and, for Other, non-blank text. Errors use the prototype's exact messages,
a GOV.UK error summary, inline errors and an `Error:` page-title prefix.

A valid technical selection is stored in the Yar session as `technicalArea` and
`technicalOther` and redirects to `/report-issue/description`. Other
text is trimmed and cleared when a listed option is selected. Back links restore
the saved selection and text.

Both branches use one description controller and template at
`/report-issue/description`. Its Back link returns to the attributes page for a data
issue or the technical question for a technical issue. Missing prerequisite answers
redirect to the appropriate earlier step. The previous technical description URL
redirects to this shared URL. The description page uses the **GOV.UK Character
Count component**, including its supplied JavaScript, for the prototype's
2,000-character counter and hint. No custom character-counting JavaScript is used.
Its onward Continue button remains disabled until the following step is implemented;
description text is not saved yet and no report or notification is submitted.

CSRF validation now covers application forms; the OIDC callback remains exempt
because it is verified by the authentication flow. Include the hidden `crumb`
field on any future POST form.

### Manual validation testing

Use a new incognito or private browsing session to start with no saved form
selections. Sign in, then click Continue on the initial page without selecting an
issue type to check the error summary and inline validation message.

Private windows can share the same private browsing session. To repeat the test
with a fresh session after making selections, close **all** incognito/private
windows and open a new one. A new tab in an existing session may restore saved
selections.

## GeoNetwork dataset catalogue

The helpers in `src/server/datasets/geonetwork/` reuse the viewer's field mapping,
accessors and test fixture from commit `ac0c7b3441299715149d174e8a8ef21aec9fa349`.
They call the same `POST /search/records/_search` GeoNetwork endpoint. Requests use
Node 24's native fetch, a 10-second timeout, and the shared external-call logging
helper. No additional npm package or public route is needed.

Set these variables in `.env` locally or through deployment configuration:

```dotenv
GEONETWORK_API_URL=http://localhost:8080/geonetwork/srv/api
GEONETWORK_DATASET_CATEGORIES=landModelGrids,landModelParcels
```

Categories are exact, case-sensitive **catalogue category IDs** (`cat.keyword`),
not ISO topic categories (`cl_topic`) or INSPIRE themes. Matching any configured
category includes the dataset. Comma-separated entries are trimmed, blank entries
ignored and duplicates removed. Leave the category variable unset or empty for
all catalogue categories. Metadata templates are always excluded. The viewer's
hard-coded excluded categories are deliberately not carried over: this application
can explicitly include reference datasets or land models when required.

```javascript
import {
  listDatasets,
  queryDatasets,
  getDatasetMetadata
} from '#/server/datasets/geonetwork/catalogue.js'

// All matching datasets, suitable for a future selector.
const datasets = await listDatasets()
const items = datasets.map(({ id, title }) => ({ value: id, text: title || id }))

// Optional title/abstract search, returning one page and its total.
const { results, total } = await queryDatasets('soil', { from: 0 })

// Optional detail lookup; returns null for missing or filtered-out records.
const metadata = datasets.length ? await getDatasetMetadata(datasets[0].id) : null
```

Summaries contain `{ id, title, inspireTheme }`. An empty query lists results by
title; text search sorts by relevance, matching the viewer. The category filter
applies to every page and to detail lookups. `listDatasets` retrieves pages of up
to 500 records until the full result total is reached. Catalogue-side search-window
limits, HTTP/network errors, timeouts, invalid responses and incomplete/overlapping
pages reject the call rather than silently producing a partial dropdown. Callers
should handle these errors when the selection feature is implemented.

### Local GeoNetwork and test data

If developing GeoNetwork functionality you will need GeoNetwork running, a dockerised version with the custom plugins is available
in [DEFRA-GEP-metadata-management](https://dev.azure.com/defragovuk/DEFRA-GEP/_git/DEFRA-GEP-metadata-management) for use with
this project, the `gep-find-geo-data-frontend` and the `gep-land-model-viewer-frontend`.

Start the shared GeoNetwork from `DEFRA-GEP-metadata-management` and import its test data separately (see its README.md).
This follows the same Docker setup as the two frontend repositories. Access to the
Azure DevOps repository is required. Use its README for the Docker Compose commands,
custom plugins and test-data import, rather than a second GeoNetwork stack in this
repository. The catalogue helpers read metadata from
`http://localhost:8080/geonetwork/srv/api` by default.

After importing test data, verify the configured category filter from this repository:

```bash
node --env-file-if-exists=.env --input-type=module -e 'const { listDatasets } = await import("./src/server/datasets/geonetwork/catalogue.js"); console.table(await listDatasets())'
```

Set `GEONETWORK_DATASET_CATEGORIES` to the category IDs assigned to your test records
to check that only matching datasets are returned. Leave it empty to list all
non-template records. The Other dataset dropdown itself is not implemented yet.

## Authentication

The service uses the same OIDC authorization-code flow with PKCE as
[`gep-land-model-viewer-frontend`](https://github.com/DEFRA/gep-land-model-viewer-frontend/tree/ac0c7b3441299715149d174e8a8ef21aec9fa349).
The auth controllers, OIDC plugins, Cognito/local JWT assertion providers, session
helpers, URL helpers and logging are copied from that revision. The header SCSS
is also copied, including its black service name, user display name and Sign out link.
Local ports, cookie names, configuration and Vite/template integration are service-specific.

Pages require authentication by default. `/health`, static assets and the Vite
asset middleware stay public. Unauthenticated browser requests redirect to
`/auth/login`; JSON/API requests receive 401. User sessions are stored server-side,
with only an encrypted session identifier in the browser. Expired access tokens
are refreshed during session validation. Sign out drops the stored session,
clears the login cookie and redirects to the provider's logout endpoint.

### Local development

```bash
docker compose up -d redis keycloak
npm ci
npm run dev
```

Authentication is required by default (`AUTH_REQUIRED=true`). To work locally
without signing in or starting Keycloak, set this in `.env` and restart `npm run dev`:

```dotenv
AUTH_REQUIRED=false
```

This setting is honoured only with `NODE_ENV=development` (set by `npm run dev`)
and a loopback `APP_BASE_URL`, such as `http://localhost:3004`. When disabled,
the server binds to loopback instead of the configured public interface. The
user name and Sign out link are absent; no fake user or credentials are created.
CSRF validation and session-backed form selections remain active. Redis is still
needed unless you also set `SESSION_CACHE_ENGINE=memory` for local development.

Set `AUTH_REQUIRED=true`, or remove the variable, to require login again. The
variable cannot disable authentication in production, tests, or when `APP_BASE_URL`
points to a non-local hostname. `npm start` continues to require authentication.


The local provider signs client-assertion JWTs with the development secret in the
imported Keycloak realm, rather than calling AWS Cognito. The pre-configured user
is `dev` / `dev`; the local Keycloak admin credentials are `admin` / `admin`.

| Service | Address |
| --- | --- |
| Feedback frontend | `http://localhost:3004` |
| Keycloak | `http://localhost:8084/land-model-feedback` |
| Redis | `127.0.0.1:6382` |

These ports and the `landModelFeedbackSessionCookie` /
`landModelFeedbackUserSessionCookie` development cookie names allow the feedback
frontend and viewer to run at the same time. Compose starts infrastructure;
run the frontend on the host with `npm run dev`, as in the viewer.

Set `SESSION_CACHE_ENGINE=memory` to run without Redis; sessions then disappear
on restart. Unit and integration tests use memory automatically and do not need
Keycloak, AWS or a network connection. They include the viewer's auth/logging
suites and exercise protected pages with its `mockAuthCredentials` fixture.

### Deployed environments (CDP)

Set `COGNITO_ENABLED=true`, `COGNITO_IDENTITY_POOL_ID`, `OIDC_CLIENT_ID`,
`OIDC_WELL_KNOWN_CONFIGURATION_URL`, `APP_BASE_URL` and a service-specific
`SESSION_COOKIE_PASSWORD` through the deployment configuration. Cognito obtains
`GetOpenIdTokenForDeveloperIdentity` tokens for the `${serviceName}-aad-access`
provider; these are sent as JWT client assertions to the OIDC provider. The local
`OIDC_CLIENT_SECRET` is not used by the Cognito provider. Redis and secure cookies
are the deployed defaults; the application's registered redirect URI must be
`${APP_BASE_URL}/auth/callback`.

Request logging, trace IDs and external OIDC/Cognito operation timing follow the
viewer. External-call timing logs omit URLs, credentials and payloads. Use
`LOG_FORMAT=pino-pretty` locally or `LOG_FORMAT=ecs` for structured logs, and
`LOG_LEVEL=debug` to include external-call timing.

## Docker

### Development image

> [!TIP]
> For Apple Silicon users, you may need to add `--platform linux/amd64` to the `docker run` command to ensure
> compatibility fEx: `docker build --platform=linux/arm64 --no-cache --tag gep-land-model-feedback-frontend`

Build:

```bash
docker build --target development --no-cache --tag gep-land-model-feedback-frontend:development .
```

Run:

```bash
docker run --env-file container.env -p 3000:3000 gep-land-model-feedback-frontend:development
```

### Production image

Build:

```bash
docker build --no-cache --tag gep-land-model-feedback-frontend .
```

Run:

```bash
docker run --env-file container.env -p 3000:3000 gep-land-model-feedback-frontend
```

Both images require a `container.env` containing the authentication and Redis
settings for their environment. `APP_BASE_URL` must be the browser-facing URL;
the OIDC issuer and token endpoints must also be reachable from inside the container.
For the bundled local Keycloak setup, run the frontend on the host as described above.

### Docker Compose

Compose provides Redis, Keycloak, Floci (AWS services) and MongoDB infrastructure.
For authentication development only Redis and Keycloak are needed:

```bash
docker compose up -d redis keycloak
npm run dev
```

The frontend is run separately on the host, matching the viewer's development setup.

### Dependabot

Dependabot is configured in [.github/dependabot.yml](.github/dependabot.yml) to automatically create pull requests for dependency updates weekly.

### SonarCloud

SonarCloud runs static analysis on pull requests via the [Check Pull Request](.github/workflows/check-pull-request.yml) workflow. Configuration is in [sonar-project.properties](./sonar-project.properties). Results are available on the [SonarCloud dashboard](https://sonarcloud.io/summary/new_code?id=DEFRA_gep-land-model-feedback-frontend).

## Branching Strategy

This project follows [Gitflow](https://defra.github.io/software-development-standards/guides/developer_workflows/#gitflow) with `develop` as the integration branch and `main` for production releases. Releases and hotfixes merge into `main` only - the [Auto Back-merge](.github/workflows/auto-back-merge.yml) workflow handles syncing `main` back into `develop` automatically. See [Contributing](CONTRIBUTING.md#branching) for full details.

## Contributing to this project

Please read the [contribution guidelines](CONTRIBUTING.md) before submitting a pull request.

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

> Contains public sector information licensed under the Open Government license v3

### About the licence

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable
information providers in the public sector to license the use and re-use of their information under a common open
licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.

## Upstream template synchronisation

Last synchronised with `DEFRA/cdp-node-frontend-template` at
`475ec6629247a90932369f196ed051d2a7d2d49b` (22 October 2026), using the
original repository snapshot `83c6758` as the three-way comparison base.

The integration adopts Vite, the upstream route/plugin layout, Node 24.22.1,
native environment proxy support, dependency updates and upstream cookie/analytics handling.
Application branding, privacy/accessibility pages, ESLint formatting and Gitflow release
workflows are retained. Template creation/validation workflows remain removed.

For the next update, compare the recorded upstream commit against the new template tip
and apply those changes with a three-way merge, preserving the application-specific changes.

Security overrides keep `hapi-pulse` on the patched Joi 18 release used by the
application and replace Blankie’s discontinued `@hapi/joi` dependency with its
maintained Joi 17 equivalent. The lockfile also includes compatible security patches.
