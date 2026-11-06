# Local backing services

All required backing services are defined in [one Compose file](../compose.yml).
Run `npm run services:up` from the repository root after installing dependencies.
It waits for healthy services, then seeds the catalogue. The frontend runs
separately with `npm run dev`.

The stack includes Redis, Keycloak, GeoNetwork, PostgreSQL, Elasticsearch,
CDP Uploader, its private Redis and LocalStack for upload storage and queues.
Public ports bind to loopback; the internal database, index and uploader cache
have no host ports. LocalStack initialisation creates the evidence/quarantine
buckets and mock scan queues automatically.

## Sample datasets

Startup imports the three synthetic records in `compose/geonetwork/datasets.json`.
Two have category `feedback-test`; the third has `feedback-excluded`. Set
`GEONETWORK_DATASET_CATEGORIES=feedback-test` in `.env` and restart the frontend
to verify category inclusion. Browse them with **Data issue → Other**.

Re-run only the import with:

```bash
npm run geonetwork:seed
```

Imports overwrite only these fixed synthetic record IDs, so repeated startup
avoids duplicate records and preserves other catalogue data. The script always
uses the loopback development catalogue, not the configured deployment URL.

## Upload testing

Choose one or more small files on the evidence page and select **Upload files**.
Clean files appear under **Uploaded files** once checking completes. Upload a file
whose name contains `virus` to test a simulated rejection. Configure size and MIME
limits as described in [Configuration](configuration.md#evidence-uploads).

Inspect stored objects with:

```bash
docker compose exec localstack awslocal s3 ls s3://atlas-feedback-evidence/evidence/ --recursive
```

## Stop, restart and diagnose

```bash
npm run services:down
npm run services:up
docker compose ps
docker compose logs --tail 100 geonetwork
docker compose logs --tail 100 cdp-uploader
```

`services:down` retains the named GeoNetwork data, database and index volumes.
Application sessions and local upload storage are disposable; recreate test
uploads after replacing those containers. Avoid `docker compose down -v` unless
you intend to delete the local catalogue as well.

If startup times out, check the named service's logs and available Docker memory.
GeoNetwork and Elasticsearch can take several minutes on first startup. Port
conflicts usually indicate an older stack or another application is still running;
use `docker compose ls` and `docker ps` to identify it.

## Migrating from the separate Compose files

Stop the previous standalone projects before starting the combined stack:

```bash
docker compose --project-name atlas-feedback-geonetwork down
docker compose --project-name atlas-feedback-uploader down
npm run services:up
```

Run these from this checkout, using the new `compose.yml`. Do not add `-v`.
The combined file reuses the existing `atlas-feedback-geonetwork_catalogue-*`
volumes. Previous local upload sessions and test uploads may need recreating.
Compose may warn that these volumes belong to the previous project; the existing
catalogue data is still reused.

The separate `geonetwork:up`, `geonetwork:down`, `uploader:up` and `uploader:down`
scripts have been replaced by `services:up` and `services:down`.
