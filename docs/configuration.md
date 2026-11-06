# Configuration

Copy [`.env.example`](../.env.example) to `.env` on first setup. Existing files are
preserved by the README's setup command. The defaults match [the local Compose
stack](../compose.yml); most development work needs no further configuration.
Restart the frontend after editing `.env`.

## Authentication

Authentication is required by default. Keycloak imports a local realm containing
the **dev / dev** user; its admin console uses **admin / admin**.

Set `AUTH_REQUIRED=false` to bypass authentication for loopback local development.
This setting cannot disable authentication in deployed environments. Keep
`APP_BASE_URL=http://localhost:3004` for the local redirects and cookie settings.

For CDP deployments, configure the following through deployment configuration:

- `SESSION_COOKIE_PASSWORD`: a unique, randomly generated secret of at least
  32 characters, held in the deployment secret store. The public development
  default is rejected in production.
- `SESSION_COOKIE_SECURE=true`.
- `COGNITO_ENABLED=true` and `COGNITO_IDENTITY_POOL_ID` for client assertions.
- `APP_BASE_URL` and `OIDC_WELL_KNOWN_CONFIGURATION_URL`: trusted HTTPS URLs
  without embedded credentials or fragments, plus the deployed OIDC client ID.

Production startup rejects unsafe values for these settings. Local Keycloak and
`AUTH_REQUIRED=false` remain available in development. A fresh sign-in and sign-out
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
Issue reference: ((reference))

Submitted by: ((submitter_email))

((answers))

File downloads
((file_downloads))
```

Add `((submitter_email))` to existing Notify templates as well. It is the email
address from the authenticated user session, saved with the submitted report.
It cannot be overridden through form inputs. When the identity provider supplies
no email address, or local authentication is disabled, its value is `Not available`.
The email address is included in Notify personalisation, not application logs.

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

