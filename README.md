# ATLAS issue reporting frontend

[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_gep-land-model-feedback-frontend&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=DEFRA_gep-land-model-feedback-frontend)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_gep-land-model-feedback-frontend&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=DEFRA_gep-land-model-feedback-frontend)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_gep-land-model-feedback-frontend&metric=coverage)](https://sonarcloud.io/summary/new_code?id=DEFRA_gep-land-model-feedback-frontend)

Report data and technical issues with ATLAS land datasets and services. Built on
Defra's CDP Node.js frontend template using Hapi and GOV.UK Frontend.

## Run locally

Install [Node.js](https://nodejs.org/) using [nvm](https://github.com/nvm-sh/nvm),
and Docker with Docker Compose v2. The pinned Node version is in `.nvmrc`.

```bash
nvm install
nvm use
npm ci
test -f .env || cp .env.example .env
npm run services:up
npm run dev
```

Open [http://localhost:3004](http://localhost:3004) and sign in with **dev / dev**.
To skip sign-in locally, set `AUTH_REQUIRED=false` in `.env` and restart the app.

[`compose.yml`](compose.yml) is the single file for all backing services.
`npm run services:up` starts them, waits for health checks, then imports the
GeoNetwork sample datasets. The first start can take several minutes. The frontend
runs on your host so code changes reload during development.

To complete submission and see confirmation, configure the GOV.UK Notify API key,
template ID and destination mailbox in `.env`. See [Configuration](docs/configuration.md#govuk-notify).

## Local services

| Service | Address | Credentials |
| --- | --- | --- |
| Frontend | [localhost:3004](http://localhost:3004) | dev / dev |
| Keycloak admin | [localhost:8084/land-model-feedback](http://localhost:8084/land-model-feedback) | admin / admin |
| GeoNetwork | [localhost:8080/geonetwork](http://localhost:8080/geonetwork) | admin / admin |
| CDP Uploader | [localhost:7337/health](http://localhost:7337/health) | — |
| LocalStack (upload storage) | `localhost:4567` | Local test credentials |
| Application Redis | `localhost:6382` | — |

Compose also starts GeoNetwork's PostgreSQL and Elasticsearch, and a private Redis
for CDP Uploader. These are available only inside the Compose network. Local
uploads use simulated virus scanning; filenames containing `virus` are rejected.

```bash
npm run services:down              # Stop backing services; keep catalogue data
docker compose ps                 # Check service status
docker compose logs -f geonetwork  # Inspect a service
```

If upgrading from the previous separate stacks, follow the short
[migration instructions](docs/local-services.md#migrating-from-the-separate-compose-files) first.

## Development

```bash
npm test                  # Tests with coverage
npm run lint              # JavaScript and SCSS checks
npm run build:frontend    # Production frontend assets
npm run security-audit    # Dependency audit
npm run setup:husky       # Enable Git hooks (optional)
```

Use a new private/incognito browser session to test validation without saved form
answers. Environment changes require restarting `npm run dev`.

- [Configuration and Notify template setup](docs/configuration.md)
- [Local services, sample data and troubleshooting](docs/local-services.md)
- [Code organisation and development guidance](docs/development.md)

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
