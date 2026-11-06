# Security review

Reviewed on 6 November 2026. This review covers application code, dependency
advisories and automated requests against an in-process test server. It is not an
independent penetration test of a deployed service or its supporting infrastructure.
The inherited template folder structure is retained.

## Findings addressed

| Finding | Change and regression coverage |
| --- | --- |
| Workflow data survived sign-out and could cross an account boundary. | Sign-out and successful fresh sign-in reset the server-side workflow session and invalidate the previous authentication session. Integration tests replay the original cookies and verify that answers, evidence references and receipts cannot be recovered. Token refresh continues to preserve the workflow. |
| Production could use the public development cookie password and local assertion provider. | Startup requires a non-default session secret, secure cookies, Cognito assertions with an identity pool, and trusted HTTPS application/discovery URLs. Tests cover rejected settings. See [configuration](configuration.md#authentication). |
| Request/error logs could contain credentials and personal data. | Shared serializers omit headers, query strings and response cookies. Error logging removes raw messages, stacks and nested SDK data before Pino/ECS conversion. Login/refresh logs omit user identifiers and names; Redis connection failures omit raw library messages. Integration tests exercise both logging formats with synthetic secret markers in errors, requests and payloads. External call info/debug summaries retain operation, duration, outcome and status. |
| Asset prefix matching could exempt future application routes such as `/publicity` from CSRF protection and cache controls. | Exemptions now match the asset path or its slash-delimited children. Tests reject tokenless POSTs to similar prefixes and accept matching CSRF tokens. The exact OIDC callback retains its PKCE-based exemption. |
| Production CSP permitted arbitrary WebSocket destinations and data URL connections. | Broad WebSocket schemes are development-only; data connections are removed. Production tests check connection, form, script, framing and object restrictions. |
| Development debugging listened on every network interface. | The Node inspector binds to `127.0.0.1` in both development scripts. |
| A transitive development dependency had a denial-of-service advisory. | The targeted `minimatch@^10` override uses patched `11.0.1`; unaffected version 3 dependencies remain unchanged. This temporary cross-major override is covered by lint, build and tests and should be removed when the parent dependencies adopt a patched release. [Advisory GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). |

The regression suite also exercises existing redirect normalization, escaped user
content and filenames, authentication bypass restrictions, uploader session tokens,
scan completion gating, private bucket/key validation and CSRF-protected submissions.
The previously started accessibility audit is retained; upload status now changes
when the user selects **Check again**, avoiding a timed full-page refresh.

## Verification

Run with the Node version declared in `package.json`:

```sh
npm run lint
npm test
npm run build:frontend
npm audit
```

Verification completed with 599 passing tests across 64 test files, 98.48% line
coverage and 97.55% branch coverage. Lint and frontend build passed; the dependency
audit reported zero known vulnerabilities.

The added security tests make no external API calls or real email submissions.
`npm audit` describes known npm advisories at the time it runs; it does not scan
container images or prove the absence of application vulnerabilities.

## Deployment verification still required

A deployed penetration test should exercise the real identity provider and logout
flow, TLS termination/proxy headers, ingress rate limits, session storage isolation
and private uploader/S3 access policies. Check the deployed CDP Uploader's malware
scanning, MIME/type enforcement and per-file limits using its real scan pipeline;
the frontend's tests mock that service. Confirm permitted upload types and sizes
in deployment configuration, and set evidence retention/lifecycle policies.

Rate limits and upload/storage quotas need to be established at the deployed
platform/uploader boundary; they are not enforced globally by this frontend.
Notify retries are bounded, but a lost successful response can still produce a
duplicate email because Notify's tracking reference is not an idempotency key.
These operational controls and live integrations were not penetration-tested here.
