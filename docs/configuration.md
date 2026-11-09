# Configuration

Copy [`.env.example`](../.env.example) to `.env` on first setup. Existing files are
preserved by the README's setup command. The defaults match [the local Compose
stack](../compose.yml); most development work needs no further configuration.
Restart the frontend after editing `.env`.

## Authentication

Authentication is required by default. Keycloak imports a local realm containing
the **dev / dev** user; its admin console uses **admin / admin**.

Set `AUTH_REQUIRED=false` to bypass authentication, including in a deployed test
environment while Cognito setup is pending. Restart or redeploy after changing it.
In this mode Cognito/OIDC plugins and sign-in/sign-out routes are not registered,
and users can access application routes without signing in. No Cognito identity
pool or OIDC configuration is required. Use this only on a test deployment where
unauthenticated access is intended; restore `AUTH_REQUIRED=true` and redeploy to
require sign-in again. Authentication remains enabled by default.

Production still requires `SESSION_COOKIE_PASSWORD`, `SESSION_COOKIE_SECURE=true`,
and a trusted HTTPS `APP_BASE_URL`, because the workflow still uses sessions and
CSRF protection. Reports submitted without sign-in have `Not available` for the
user email address.

Local loopback development still binds to loopback when auth is disabled. Keep
`APP_BASE_URL=http://localhost:3004` for local development.

For CDP deployments with authentication enabled, configure the following through deployment configuration:

- `SESSION_COOKIE_PASSWORD`: a unique, randomly generated secret of at least
  32 characters, held in the deployment secret store. The public development
  default is rejected in production.
- `SESSION_COOKIE_SECURE=true`.
- `COGNITO_ENABLED=true` and `COGNITO_IDENTITY_POOL_ID` for client assertions.
- `APP_BASE_URL` and `OIDC_WELL_KNOWN_CONFIGURATION_URL`: trusted HTTPS URLs
  without embedded credentials or fragments, plus the deployed OIDC client ID.

`HTTP_PROXY` enables the same `setupProxy()` implementation used by the Land Model
Viewer. Startup configures both the Undici dispatcher and `global-agent` before
creating the server or making authentication requests. The current CDP frontend
template no longer includes this helper; the viewer implementation is copied unchanged.

Production startup rejects unsafe session and app URL settings in both modes,
and validates Cognito/OIDC settings when authentication is enabled. Local Keycloak
remains available in development. A fresh sign-in and sign-out
clear the previous workflow's answers, uploaded-file references and receipt.
See `src/config/config.js` for the full schema and [the security review](security-review.md)
for verification scope and deployment checks.

## Dataset catalogue

`GEONETWORK_API_URL` defaults to the local catalogue. Set
`GEONETWORK_DATASET_CATEGORIES=feedback-test` to show the two matching sample
datasets in the Other dataset dropdown. It excludes the sample record with the
`feedback-excluded` category by including only matching categories.

For multiple categories, use comma-separated names, for example
`landModelGrids,landModelParcels`. Categories match catalogue names case-sensitively,
with any matching category included. An empty value lists all dataset categories.
The client retrieves all pages and returns dataset IDs and names only.

## Evidence uploads

| Variable | Local default | Purpose |
| --- | --- | --- |
| `CDP_UPLOADER_URL` | `http://localhost:7337` | Private uploader API |
| `CDP_UPLOADER_PUBLIC_URL` | `http://localhost:7337` | Browser upload origin; empty on CDP for the same-origin route |
| `EVIDENCE_S3_BUCKET` | `atlas-feedback-evidence` | Destination for clean uploads |
| `EVIDENCE_MAX_FILE_SIZE_MB` | `100` | Maximum size per file in megabytes |
| `EVIDENCE_ALLOWED_MIME_TYPES` | Empty | Comma-separated allowed MIME types; empty allows all |

One MB is 1,000,000 bytes. Decimal sizes such as `2.5` are supported and rounded to
the nearest byte. Use exact MIME types such as `application/pdf,image/jpeg,image/png`,
not file extensions or wildcards. The uploader enforces both restrictions; the
GOV.UK file input displays them and applies the type filter to the file picker.
Start a new private browser session after changing restrictions so an existing
upload does not retain its previous settings. The former byte-based
`EVIDENCE_MAX_FILE_SIZE` setting has been replaced by `EVIDENCE_MAX_FILE_SIZE_MB`.

Deployed buckets must be provisioned and enabled for
[CDP Uploader](https://github.com/DEFRA/cdp-uploader). Configure the internal uploader
URL and leave the public URL empty on CDP. No uploader AWS credentials are needed
by this frontend. Use real virus scanning in deployed environments.

## Analytics

Set `GOOGLE_TAG_MANAGER_KEY` to enable analytics and the optional cookie controls.
When it is empty, the optional-cookie banner and analytics controls on the Cookies
page are hidden.

## Evidence downloads

Configure `EVIDENCE_DOWNLOAD_AAD_ROLE` with the exact, case-sensitive AAD app-role
value that should permit evidence downloads, for example `Evidence.Reader`.
An empty value denies role-based downloads. This role must appear in the validated OIDC
ID token's `roles` array. Claims and roles are copied into the server-side user session at
sign-in and updated when a refreshed ID token provides claims. If a refresh does
not include an ID token, roles remain those from sign-in. Users should sign in
again after role assignments change. Group object IDs are not currently checked;
AAD groups can be assigned the app role, or the claim mapping can be adapted once
the identity team's token shape is confirmed.

`GET /evidence/download/{uploadId}/{fileId}` requires a signed-in session with that
role. Unauthenticated visitors are sent to sign-in and returned to the download
path. Signed-in users without the role receive 403 unless the testing override is
enabled. `AUTH_REQUIRED=false` always
disables downloads, even though other application pages remain usable. A role
holder can download any clean evidence object in the configured bucket's
`evidence/` prefix, independently of the uploader's browser session. UUIDs identify
files; knowing them alone does not grant access.

For remote development testing, set:

```dotenv
EVIDENCE_DOWNLOAD_ALLOW_ALL_USERS=true
```

This Boolean setting defaults to `false`. Enabling it allows every signed-in user
to download evidence, even if no download role is configured. It does not allow
anonymous downloads or override `AUTH_REQUIRED=false`. Restart or redeploy after
changing it. Set it back to `false` to restore the role check.

Download access logs intentionally include all validated ID-token identity claims
(including names, email addresses, roles, groups and custom claims) to diagnose
identity mapping. Claims are stored in the server-side session separately from
access and refresh tokens; those tokens are not included in these logs. Existing
sessions created before this change have no stored claims: sign out and sign in
again to populate them. Refreshed ID-token claims replace the stored claims when
available.

Search for `Evidence download access allowed` or `Evidence download access denied`
to see claims, the configured role and whether the testing override was used.
Other events report download start, stream end, stream failure, missing objects,
and storage or metadata failures. A stream-end event means the S3 stream ended,
not confirmation that the user saved the file. These events are structured under
`evidenceDownload` and also printed as single console lines with JSON diagnostics
in the message. As with OIDC diagnostics, the console fallback bypasses
`LOG_ENABLED` and `LOG_LEVEL`. Unauthenticated visitors are redirected before the
handler and have no identity claims to log.

CDP Uploader already places clean files in
`evidence/<upload UUID>/<file UUID>` and records original names in `filename` or
RFC 2047 `encodedfilename` S3 metadata. The application reads those existing
objects; it does not copy, rename or tag them. The stored key has no extension,
while the email label and downloaded attachment retain the original filename and
extension. Downloads stream through the application as attachments, with caching
disabled and no inline rendering. Missing objects return 404; S3 failures return a
generic 503. Existing report links work for as long as their objects are retained.

The frontend's deployment IAM role needs `s3:GetObject` on
`arn:aws:s3:::<EVIDENCE_S3_BUCKET>/evidence/*`. For SSE-KMS encrypted buckets it also
needs `kms:Decrypt` for the bucket's key. This feature needs no write or list
permissions. The bucket must remain private. AWS credentials and region use the
standard SDK provider chain; configure `AWS_REGION` as needed. Leave
`EVIDENCE_S3_ENDPOINT` unset in deployments. For local LocalStack access, use:

```dotenv
EVIDENCE_S3_ENDPOINT=http://localhost:4566
AWS_REGION=eu-west-2
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
```

Tests use synthetic identity claims and mocked S3/Notify calls. Confirm a real
AAD role-bearing session and the service's bucket permissions in the target
environment before relying on email downloads there.

## GOV.UK Notify

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
## Issue reference
((reference))

## Submitted by
((submitter_email))

((answers))

## File downloads
((file_downloads))
```

Add `((submitter_email))` to existing Notify templates as well. It is the email
address from the authenticated user session, saved with the submitted report.
It cannot be overridden through form inputs. When the identity provider supplies
no email address, or local authentication is disabled, its value is `Not available`.
The email address is included in Notify personalisation, not application logs.

`answers` formats each label as a Notify Markdown subheading (`## Label`), followed
by its value on the next line, with a blank line between items. Use the template
body above for existing templates too, so reference, submitter and file downloads
follow the same heading-then-value layout. The subject remains `((email_subject))`.

`answers` contains the same labels and values shown on Check your answers, including
multiline descriptions, the selected workflow's answers and filenames. The page
and email share the same row builder. `file_downloads` contains Notify Markdown
links labelled with each original filename, or `No files added`. Keep the existing
`((file_downloads))` placeholder in the email template. Each link goes to the
application's authenticated endpoint, rather than S3 directly. No email attachments
or presigned S3 URLs are sent.

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
real emails; they cover payload content, file links, retries, timeouts,
permanent errors, failed-submit recovery and confirmation gating.

Receipts remain session-scoped; no external case system or durable report store is
integrated yet. Clean evidence is stored by CDP Uploader in the configured S3 bucket;
file IDs, upload IDs, names, sizes, checksums and S3 references are included in the
session receipt. Removing an attachment removes its report reference, not the S3
object. Configure the destination bucket lifecycle/retention policy separately.

