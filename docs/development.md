# Build and deploy

## Development checks

Follow the [local setup](../README.md#run-locally), using the Node.js version in
[`.nvmrc`](../.nvmrc). Install pinned dependencies with `npm ci`.

```bash
npm test
npm run lint
npm run build:frontend
npm run security-audit
```

Tests mock external services and need neither Docker nor Notify credentials.
`npm run build:frontend` compiles production assets into `.public/`.
For contribution and release rules, see [Contributing](../CONTRIBUTING.md).

## Production image

Build the production stage from the repository root:

```bash
docker build --target production -t atlas-feedback-frontend .
```

The image includes compiled assets and production dependencies. It starts with
`node src` and listens on port `3000` by default. Supply runtime configuration
through environment variables; `.env` files are excluded from the image.

For a local image check, create a file with deployment settings, then run:

```bash
docker run --rm -p 3000:3000 --env-file /path/to/deployment.env atlas-feedback-frontend
```

Set `NODE_ENV=production` explicitly. Backing-service addresses must be reachable
from the container; `localhost` refers to the container itself.

## Deploy through CDP

1. Configure Redis, the GeoNetwork catalogue, CDP Uploader, the evidence bucket
   and GOV.UK Notify using the [configuration guide](configuration.md).
2. Set production session and authentication settings, including the public
   application URL, OIDC callback registration and deployment secrets. Grant the
   service IAM role evidence-download permissions if downloads are required.
3. Follow the [release workflow](../CONTRIBUTING.md#releases) to publish an image,
   then deploy the release artifact through the CDP portal.
4. Check `/health`, sign-in and sign-out, catalogue access, evidence upload and a
   complete report submission. Verify emailed download links with an authorised
   account and confirm delivery in Notify.

Local Compose credentials and simulated virus scanning are for development only.

## Code layout

- `src/config/`: environment schema and validation.
- `src/server/routes/report-issue/`: page routes, controllers, templates and tests.
- `src/server/common/services/`: GeoNetwork, CDP Uploader and Notify clients.
- `src/server/auth/`: sign-in, callback and sign-out routes.
- `src/client/`: browser scripts and styles.

Follow the [Defra Node.js](https://defra.github.io/software-development-standards/standards/node_standards/)
and [JavaScript standards](https://defra.github.io/software-development-standards/standards/javascript_standards/).
Keep validation on the server and include the hidden `crumb` CSRF token in
application POST forms. Wrap new external API calls with `logExternalCall`, using
fixed service and operation names without user input or payloads.
