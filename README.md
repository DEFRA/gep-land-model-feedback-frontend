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
- [Local evidence uploads](#local-evidence-uploads)
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
continues to `/report-issue/data/location`. The Other option reveals a GOV.UK Select populated by `listDatasets()` using the
configured `GEONETWORK_DATASET_CATEGORIES` inclusion filter. Continue verifies the
selected ID against the current filtered catalogue and saves its server-supplied
name. Other datasets go directly to the shared description page, with the
prototype's **Where is the issue?** input; land-model location and attributes are
skipped. The chosen dataset and location are included on Check your answers and
in the session receipt. Changing back to Land Model clears the Other selection.
An empty catalogue is explained in the conditional panel. Catalogue failures show
a retry message and block Other submissions with HTTP 503; Land Model remains
available.

**Enter the location of the issue** uses GOV.UK conditional radios for Grid cell,
Feature and Other, with the prototype's labels, hints and error messages. Continue
requires a location method and non-blank text for its selected input. Only that
input is saved, trimmed, in the Yar session as `issueLocation`; changing the method
clears the previous input. Back restores the saved answers. Grid cell and feature
references are checked for British National Grid format (two grid letters alone for
a 100 km square, or followed by 2, 4, 6, 8 or 10 digits for finer scales, optionally
spaced into equal easting and northing groups)
and OSID format (a hyphenated UUID), respectively. Letters are case-insensitive.
No catalogue or geographic lookup is performed to check that the reference exists.
A valid location continues to `/report-issue/data/attributes` for **Which attributes
are incorrect?**. The GOV.UK checkboxes offer Land cover, Land management, Land use,
Ownership, Protected areas and Soils in alphabetical order with **Select all that apply**.
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
Continue requires a non-blank description of up to 2,000 characters, saves the
trimmed text as `issueDescription` in the Yar session, and redirects to
`/report-issue/evidence`. Back restores the saved description. Empty or over-limit
submissions show a GOV.UK error summary and inline error.

The shared **Add any evidence of the issue** page uses the
[improved GOV.UK File upload component](https://design-system.service.gov.uk/components/file-upload/#using-the-improved-file-upload-component),
with `javascript: true` and the library's `FileUpload` initializer. Users can choose
or drop multiple files. **Upload files** sends the multipart form directly to CDP
Uploader, following the [CDP basic upload example](https://github.com/DEFRA/cdp-example-node-frontend/tree/main/src/server/basic-upload).
The frontend receives scan status and private S3 references, never file contents.
The waiting page refreshes every two seconds while scanning. Only files marked
complete, with the configured bucket and batch-specific S3 path, are accepted.
Rejected-file messages appear in the GOV.UK error summary and beside the input;
clean files in a mixed batch remain attached. Users can add more batches or remove
attachments. Evidence is optional: Continue opens Check your answers without
requiring a file, but pending scans cannot be bypassed through review or Submit.
See [Local evidence uploads](#local-evidence-uploads) to run the uploader locally.

**Check your answers** uses the GOV.UK Summary list component. It shows Issue type,
Location ID (or Location) and Incorrect attributes for a data issue, or Relates to
for a technical issue, followed by Description and Files. Files shows uploaded
filenames, or **No files added** when there are no attachments. The labels follow the prototype,
using ATLAS terminology. Description line breaks and attribute lists are preserved;
user-provided text is escaped.

Change links restore the saved answer and use a fixed
`returnTo=check-your-answers` flag. A valid change returns directly to the review;
validation errors retain this flag. If changing the issue type requires missing
answers in the new branch, the normal workflow guards send the user to the next
required step. Arbitrary return URLs are ignored. Back returns to the evidence
page. Submit is a CSRF-protected POST to `/report-issue/check-your-answers`.
It revalidates the workflow prerequisites, records an answer snapshot and reference
in the Yar session, and sends an issue report email through GOV.UK Notify. Only
after Notify accepts the email does it redirect with HTTP 303 to
`/report-issue/issue-reported`.

The **Issue reported** page uses the GOV.UK confirmation Panel. Its reference is
the first 12 hexadecimal characters of a server-generated `crypto.randomUUID()`,
with hyphens removed and letters uppercased. The full UUID is retained as the
receipt ID alongside an answer snapshot. The shortened display reference is
randomised, not a guarantee of global uniqueness. Refreshing the confirmation or
posting the same answers again reuses the receipt; submitting changed answers
creates a new one. Opening the confirmation URL without an email accepted by
Notify returns to the review page. Receipts are session-scoped and expire with the session.

### Issue report email (GOV.UK Notify)

Configure the existing destination mailbox and Notify settings:

```dotenv
SUPPORT_MAILBOX_ADDRESS=atlas-support@example.com
GOV_UK_NOTIFY_API_KEY=your-notify-api-key
GOV_UK_NOTIFY_TEMPLATE_ID=your-email-template-uuid
GOV_UK_NOTIFY_EMAIL_SUBJECT=ATLAS issue report
```

Store the API key as a secret in deployed environments. It is marked sensitive in
configuration and is never logged. The app can start without Notify credentials,
but submission fails safely until the API key, template ID and destination mailbox
are configured. Replace the example support mailbox with the real destination.
The template ID must be a UUID and the subject prefix must be a non-blank single
line of at most 200 characters. The reference is always appended, for example
`ATLAS issue report - A1B2C3D4E5F6`.

Create a Notify **email** template with this subject:

```text
((email_subject))
```

For its body, use:

```text
Issue reference: ((reference))

((answers))

File downloads
((file_downloads))
```

`answers` contains the same labels and values shown on Check your answers, including
multiline descriptions, the selected workflow's answers and filenames. The page
and email share the same row builder. `file_downloads` lists each filename followed
by `Download link not yet available`, or `No files added`. These are placeholders;
no download endpoint, signed link or attachment delivery is implemented. Private
S3 keys are not included in the email.

Requests time out after 10 seconds. Temporary network errors, HTTP 408, 429 and
5xx responses are retried up to three attempts in total, with 1-second then
2-second backoff. A valid `Retry-After` is honoured for waits up to 5 seconds;
longer waits return the retry page immediately rather than retrying too early.
Permanent errors such as invalid credentials or template configuration are not
automatically retried. Logs record the reference, attempt and status without SDK
error objects, credentials, email addresses or answer contents.

If sending fails, a GOV.UK-styled page returns HTTP 503, preserves the answers,
files and reference in the session, and offers a CSRF-protected **Try again** POST.
The confirmation URL stays unavailable until Notify accepts the email. Retrying
unchanged answers reuses the reference. Refreshing confirmation or submitting an
already accepted, unchanged report does not send another email. The confirmation
shows the recipient used for that submission, even if configuration later changes.

Notify acceptance is not a guarantee of inbox delivery. The full report UUID is
sent as Notify's tracking reference; this is not an idempotency key. A lost response
after acceptance can result in a duplicate email when retried. Retries are bounded
within the request; there is no background queue after the user leaves. Use Notify's
dashboard to investigate delivery status using the reference.

For local testing, configure a Notify test API key and an email template with the
placeholders above, then complete either workflow. Notify test keys simulate sending
without delivering emails. The automated tests use mocked transport and never send
real emails; they cover payload content, file placeholders, retries, timeouts,
permanent errors, failed-submit recovery and confirmation gating.

Receipts remain session-scoped; no external case system or durable report store is
integrated yet. Clean evidence is stored by CDP Uploader in the configured S3 bucket;
file IDs, upload IDs, names, sizes, checksums and S3 references are included in the
session receipt. Removing an attachment removes its report reference, not the S3
object. Configure the destination bucket lifecycle/retention policy separately.

CSRF validation now covers application forms; the OIDC callback remains exempt
because it is verified by the authentication flow. Include the hidden `crumb`
field on any future application POST form. The multipart form sent directly to
CDP Uploader must not include the application crumb. It uses the uploader's single-use upload URL; the return route checks the active session upload and
server-held metadata token before accepting status results.

### Manual validation testing

Use a new incognito or private browsing session to start with no saved form
selections. Sign in, then click Continue on the initial page without selecting an
issue type to check the error summary and inline validation message.

Private windows can share the same private browsing session. To repeat the test
with a fresh session after making selections, close **all** incognito/private
windows and open a new one. A new tab in an existing session may restore saved
selections.

## Local evidence uploads

The integration follows the [CDP frontend basic-upload example](https://github.com/DEFRA/cdp-example-node-frontend/tree/main/src/server/basic-upload)
and the [CDP Uploader API and local development instructions](https://github.com/DEFRA/cdp-uploader).
The optional [compose.uploader.yml](./compose.uploader.yml) is based on the
uploader's Compose setup and startup script. It creates its own Redis, LocalStack,
quarantine bucket, destination bucket, scan-result queues and mock scanner.

```bash
npm run uploader:up
npm run dev
```

The uploader is available at `http://localhost:7337`. Its isolated LocalStack
endpoint is `http://localhost:4567`; neither stack replaces the application's
Redis or existing AWS emulator. Only these two endpoints are published, bound to
loopback. Local AWS credentials are `test` / `test`, region `eu-west-2`. The image
matches the upstream `CDP_UPLOADER_VERSION` override, defaulting to `latest`.
Run `docker compose -f compose.uploader.yml pull` to update it deliberately.

Defaults are configured for this stack. To override, set these in `.env` and
restart the frontend:

```dotenv
CDP_UPLOADER_URL=http://localhost:7337
CDP_UPLOADER_PUBLIC_URL=http://localhost:7337
EVIDENCE_S3_BUCKET=atlas-feedback-evidence
EVIDENCE_MAX_FILE_SIZE_MB=100
EVIDENCE_ALLOWED_MIME_TYPES=
```

`CDP_UPLOADER_URL` is the private API endpoint used by the frontend server.
`CDP_UPLOADER_PUBLIC_URL` is the browser-facing upload origin, also allowed by the
form-action CSP. On CDP, leave the public value empty so forms post to the
same-origin `/upload-and-scan/<id>` route, and configure the internal API URL and
your service's approved bucket. The CDP Platform team must provision the bucket
and enable uploader access as described in the uploader README. No AWS credentials
or new S3 SDK are needed by this frontend for the upload/status integration.
`EVIDENCE_MAX_FILE_SIZE_MB` is a per-file limit in megabytes (1 MB = 1,000,000
bytes), defaulting to 100. Decimal values such as `2.5` are supported and converted
to the nearest byte (minimum one byte). This replaces
the previous byte-based `EVIDENCE_MAX_FILE_SIZE` setting; update existing `.env`
files to use the new name and units.

`EVIDENCE_ALLOWED_MIME_TYPES` is a comma-separated allowlist, for example
`application/pdf,image/jpeg,image/png`. Leave it empty to allow all types until the
supported types are confirmed. Use exact MIME types, not file extensions or
wildcards. Invalid MIME types and invalid size limits prevent startup.

Both restrictions are sent to CDP Uploader when an upload is initiated, so they
are enforced on uploads even if the browser's file picker is bypassed. The page
shows the configured size and types and uses the allowlist for the file picker's
`accept` attribute. Rejections appear in the GOV.UK error summary and inline error.
Restart the frontend and start a new private browser session after changing the
settings so that an existing upload session does not retain its previous limits.

To test:

1. Complete either workflow up to **Add any evidence of the issue**.
2. Choose one or more small files and select **Upload files**.
3. Wait for checking to finish; accepted files appear under **Uploaded files**.
4. Continue to Check your answers and verify the filenames. Submit retains the
   clean file references in the session receipt.
5. Try an empty file or one larger than the configured limit to check errors.
   A harmless text file with `virus` in its name exercises the local rejection path.
6. Remove a file and verify it is no longer included in the report.

The local scanner **simulates** results from the filename; it does not perform a
real antivirus scan. In deployed environments CDP supplies the actual scan service.
You can verify clean files reached local S3 with:

```bash
docker compose -f compose.uploader.yml exec localstack awslocal s3 ls s3://atlas-feedback-evidence/evidence/ --recursive
```

Stop this stack with `npm run uploader:down`. It is independent of the GeoNetwork
stack. The local uploader and AWS data are disposable and recreated when their
containers are recreated. This does not affect deployed S3 buckets.

## GeoNetwork dataset catalogue

`src/server/datasets/geonetwork/catalogue.js` calls the same
`POST /search/records/_search` endpoint and title field as the
[land model viewer](https://github.com/DEFRA/gep-land-model-viewer-frontend).
It now requests only `resourceTitleObject.default` and returns `{ id, title }`.
Detailed metadata accessors, resolution mapping and record-detail queries have
been removed because the dropdown does not use them.

```dotenv
GEONETWORK_API_URL=http://localhost:8080/geonetwork/srv/api
GEONETWORK_DATASET_CATEGORIES=feedback-test
```

Categories are exact, case-sensitive **catalogue category names** (`cat.keyword`),
not ISO topic categories or INSPIRE themes. This is an inclusion filter: matching
any listed category includes a record. Comma-separated entries are trimmed and
deduplicated; empty means all categories. Metadata templates are always excluded.
There are no viewer-style category exclusions. Requests use native fetch, a
10-second timeout and the shared external-call logger. All result pages are read;
failed, malformed or incomplete results reject rather than presenting a partial
list. The form rechecks membership on submission and never trusts a posted name.

### Local GeoNetwork and sample data

The viewer uses the shared custom GeoNetwork in
[DEFRA-GEP-metadata-management](https://dev.azure.com/defragovuk/DEFRA-GEP/_git/DEFRA-GEP-metadata-management).
You can continue using that catalogue and its import instructions. For a standalone
local dropdown test without access to that repository, this application also
provides [compose.geonetwork.yml](./compose.geonetwork.yml), based on the
[official GeoNetwork Docker setup](https://github.com/geonetwork/docker-geonetwork/tree/main/4.4.12).
It runs GeoNetwork 4.4.12, PostGIS and Elasticsearch 8.19.13. It does not include the
shared repository's custom plugins, which are not required for the title selector.

With Docker running and Node 24 selected:

```bash
npm run geonetwork:up
npm run geonetwork:seed
```

Startup can take a few minutes on first use. Only the GeoNetwork UI/API is exposed,
bound to loopback: [http://localhost:8080/geonetwork](http://localhost:8080/geonetwork).
The local test administrator is `admin` / `admin`. The importer is deliberately
fixed to that loopback URL and those development credentials; it cannot target a
remote catalogue. It imports three synthetic ISO 19139 records with fixed UUIDs,
publishes them, and verifies anonymous category-filtered search. Re-running it
overwrites only those test UUIDs, retaining other catalogue content.

- `feedback-test`: ATLAS test flood risk areas, ATLAS test woodland.
- `feedback-excluded`: ATLAS test excluded dataset.

Set the two GeoNetwork variables above in `.env`, restart `npm run dev`, choose
**Data issue → Other**, and check that only the two `feedback-test` datasets appear.
Set `GEONETWORK_DATASET_CATEGORIES=feedback-excluded` to see the third, or leave it
empty to see all three. You can verify the API independently:

```bash
node --env-file-if-exists=.env --input-type=module -e 'const { listDatasets } = await import("./src/server/datasets/geonetwork/catalogue.js"); console.table(await listDatasets())'
```

Stop the optional catalogue with `npm run geonetwork:down`. Named volumes retain
records and the index between starts. The existing authentication/session Compose
services are separate and remain unchanged. Port 8080 must be available; stop an
already running shared GeoNetwork before starting this optional stack.

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
