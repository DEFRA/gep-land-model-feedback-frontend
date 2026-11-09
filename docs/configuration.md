# Configuration

Copy [`.env.example`](../.env.example) to `.env` for local development. For
deployments, supply environment variables and secrets through CDP. Restart or
redeploy after changing configuration. The full schema is in
[`src/config/config.js`](../src/config/config.js).

## Runtime and sessions

| Variable | Deployment setting |
| --- | --- |
| `NODE_ENV` | `production` |
| `PORT` | `3000` by default in production; `3004` in development |
| `APP_BASE_URL` | Public HTTPS application URL, without credentials or fragments |
| `SESSION_COOKIE_PASSWORD` | Unique random secret of at least 32 characters; store as a deployment secret |
| `SESSION_COOKIE_SECURE` | `true` |
| `SESSION_CACHE_ENGINE` | `redis`; production rejects `memory` |
| `REDIS_HOST`, `REDIS_PORT` | Deployment Redis endpoint; production port defaults to `6379` |
| `REDIS_USERNAME`, `REDIS_PASSWORD` | Redis credentials, if required; store the password as a secret |
| `REDIS_TLS` | Defaults to `true` in production |
| `USE_SINGLE_INSTANCE_CACHE` | Defaults to `false` (cluster) in production; set `true` for standalone Redis |
| `HTTP_PROXY` | Outbound proxy URL, if required by the environment |

If applications share a hostname, use distinct `SESSION_COOKIE_NAME` and
`SESSION_CACHE_NAME` values to avoid cookie conflicts. Session and cookie
lifetimes are set with `SESSION_CACHE_TTL` and `SESSION_COOKIE_TTL` in milliseconds.

## Authentication

`AUTH_REQUIRED` defaults to `true`. Local Keycloak provides the **dev / dev**
user with the settings in `.env.example`.

For authenticated deployments, configure:

| Variable | Value |
| --- | --- |
| `COGNITO_ENABLED` | `true` |
| `COGNITO_IDENTITY_POOL_ID` | Deployment Cognito identity pool ID |
| `OIDC_CLIENT_ID` | Registered OIDC client ID |
| `OIDC_WELL_KNOWN_CONFIGURATION_URL` | Provider discovery HTTPS URL, without credentials or fragments |

Register `APP_BASE_URL` followed by `/auth/callback` as the OIDC callback URL.
`OIDC_CLIENT_SECRET` is used only for local Keycloak.

Set `AUTH_REQUIRED=false` to bypass sign-in locally or in a test deployment where
unauthenticated access is intended. Cognito/OIDC configuration is then unnecessary,
but production session, Redis and HTTPS requirements still apply. Evidence
downloads are disabled and the report submitter email is `Not available`.
Restore `AUTH_REQUIRED=true` to require sign-in again.

## Dataset catalogue

Set `GEONETWORK_API_URL` to the catalogue REST API base URL. Locally it defaults
to `http://localhost:8080/geonetwork/srv/api`.

`GEONETWORK_DATASET_CATEGORIES` accepts comma-separated, case-sensitive category
names; a dataset matching any name is included. Leave it empty for all categories.
Use `feedback-test` to show the two matching local sample datasets.

## Evidence uploads

| Variable | Local default | Purpose |
| --- | --- | --- |
| `CDP_UPLOADER_URL` | `http://localhost:7337` | Internal uploader API URL |
| `CDP_UPLOADER_PUBLIC_URL` | `http://localhost:7337` | Browser upload origin; leave empty on CDP for the same-origin route |
| `EVIDENCE_S3_BUCKET` | `atlas-feedback-evidence` | Destination bucket for clean uploads |
| `EVIDENCE_MAX_FILE_SIZE_MB` | `100` | Maximum size per file in megabytes; decimals supported |
| `EVIDENCE_EXCLUDED_FILE_EXTENSIONS` | Executables, scripts and macro-enabled Office files | Comma-separated extensions to reject, such as `.exe,.bat,.ps1`; case-insensitive, leading dots optional; empty disables exclusions |
| `EVIDENCE_ALLOWED_MIME_TYPES` | Empty | Comma-separated exact MIME types, such as `application/pdf,image/jpeg`; empty allows all |

The exclusion setting replaces the default list. For example:

```dotenv
EVIDENCE_EXCLUDED_FILE_EXTENSIONS=.exe,.com,.bat,.cmd,.msi,.scr,.dll,.ps1,.vbs,.js,.jar,.sh,.lnk,.docm,.xlsm,.pptm
```

The browser blocks excluded selections and displays a validation error. The
application also rejects excluded filenames when processing scan results, even
without JavaScript. Uploads go directly to CDP Uploader, so that server check
happens after upload; excluded files are not attached to reports. Renaming a file
can bypass extension checks: retain virus scanning and use the MIME allowlist to
restrict permitted content types. Archive contents are not checked by this filter.

Provision the bucket and enable it for
[CDP Uploader](https://github.com/DEFRA/cdp-uploader). Use real virus scanning in
deployed environments. Start a new browser session when testing changed upload
limits. Configure bucket retention separately: removing an attachment from a
report does not delete its stored object.

## Evidence downloads

| Variable | Setting |
| --- | --- |
| `EVIDENCE_DOWNLOAD_AAD_ROLE` | Exact, case-sensitive AAD app-role value, such as `Evidence.Reader`; empty denies role-based downloads |
| `EVIDENCE_DOWNLOAD_ALLOW_ALL_USERS` | Defaults to `false`; `true` allows any signed-in user to download evidence for testing |
| `AWS_REGION` | Bucket region; defaults to `eu-west-2` |
| `S3_ENDPOINT` | Leave unset in AWS; for this repository's local Compose stack, use `http://localhost:4567` |

The required role must appear in the OIDC ID token's `roles` array. Group IDs are
not checked. Sign in again after changing role assignments. Downloads require
`AUTH_REQUIRED=true`, even when the testing override is enabled. Authorised users
can download clean evidence across reports in the configured bucket.

Keep the bucket private. Grant the frontend's deployment IAM role `s3:GetObject`
on `arn:aws:s3:::<EVIDENCE_S3_BUCKET>/evidence/*` and, for SSE-KMS encryption,
`kms:Decrypt` on the bucket's key. Deployed credentials use the AWS SDK provider
chain; local development uses `test` / `test` credentials automatically.

## GOV.UK Notify

These settings are required to submit reports:

```dotenv
SUPPORT_MAILBOX_ADDRESS=atlas-support@example.com
GOV_UK_NOTIFY_API_KEY=your-notify-api-key
GOV_UK_NOTIFY_TEMPLATE_ID=your-email-template-uuid
GOV_UK_NOTIFY_EMAIL_SUBJECT=ATLAS issue report
```

Replace the example mailbox with the destination address and store the API key as
a deployment secret. The template ID must be a UUID. The subject prefix must be a
non-blank single line of at most 200 characters; the report reference is appended.
The app starts without Notify credentials, but submissions fail until configured.

Create a Notify **email** template with this subject:

```text
((email_subject))
```

Use this body, including all placeholders:

```text
## Issue reference
((reference))

## Submitted by
((submitter_email))

((answers))

((include_file_downloads??## File downloads))
((file_downloads))
```

The same template sends both emails. The app sets `include_file_downloads` to
`yes` for support and `no` for the submitter, with an empty `file_downloads` value
for the submitter. Keep the heading conditional and the links placeholder separate:
[Notify optional content](https://www.notifications.service.gov.uk/using-notify/optional-content)
cannot contain personalisation placeholders. Update existing templates to match.

The submitter receives the same reference and answers, including filenames,
without download links. The recipient comes from the signed-in session; no copy
is sent when that email address is unavailable.

`answers` contains the report answers; `file_downloads` contains authenticated
application links. `submitter_email` comes from the signed-in session, or is
`Not available` when absent. Use a Notify test API key to test without delivery.

Both emails must be accepted before confirmation. Failed sends preserve the
report for retry; an accepted support email is not resent if only the copy fails.
Reports are session-scoped, with no durable report store or background delivery
queue. Use the report reference in the Notify dashboard to investigate delivery; a retry after a lost response may
send a duplicate email.

## Analytics

Set `GOOGLE_TAG_MANAGER_KEY` to enable analytics and optional-cookie controls.
Leave it empty to hide those controls.

## Logging

`LOG_LEVEL` defaults to `info`, which includes external API outcome summaries.
Use `debug` for call lifecycle details. `LOG_FORMAT` defaults to `ecs` in
production and `pino-pretty` locally. `LOG_ENABLED=false` disables the configured
logger; diagnostic console output still bypasses these settings.

Evidence download access diagnostics include validated identity claims, including
personal information. Search for `Evidence download access allowed` or
`Evidence download access denied` to investigate permissions.
