# Security

We take the security of this service seriously.

## Automated dependency and vulnerability checks

This repository uses a combination of automated tooling to help identify and manage security issues in dependencies and application code:

### Dependabot

Dependabot is used to monitor project dependencies and raise pull requests for supported updates.

For this repository, Dependabot is configured for the `npm` ecosystem and helps keep dependencies current by proposing updates into the `develop` branch. Security updates are prioritised and are not delayed by the normal update cooldown rules.

### Snyk

Snyk is used to scan the codebase and dependencies for known vulnerabilities.

Snyk scans are run through GitHub Actions as part of the repository’s security checking approach. This provides an additional layer of assurance alongside Dependabot by identifying vulnerable packages and surfacing issues that may require review or remediation.

### Sonar

Sonar scans are also used to help detect potential code vulnerabilities and other code quality issues.

This provides additional analysis of the codebase and supports the identification of potential security hotspots that may need further review.

## How these tools are used together

Dependabot, Snyk and Sonar serve different but complementary purposes:

- **Dependabot** helps keep dependencies up to date by creating pull requests for version updates.
- **Snyk** scans dependencies and application code for known vulnerabilities and highlights security issues that need attention.
- **Sonar** analyses the codebase to help detect potential vulnerabilities, security hotspots and maintainability issues.

Using these tools together helps the team:
- reduce exposure to known vulnerabilities
- identify issues earlier in the development lifecycle
- keep third-party dependencies under regular review
- improve overall code quality and security assurance

## Reporting a vulnerability

If you believe you have found a security vulnerability in this project, please do **not** raise it in a public GitHub issue or pull request.

Instead, report it through the appropriate DEFRA or service security reporting route.

When reporting a vulnerability, please include:
- a description of the issue
- steps to reproduce
- the potential impact
- any suggested remediation, if known

## Maintenance

Security findings from automated tooling should be reviewed regularly. Where appropriate:
- dependency updates should be assessed and merged promptly
- vulnerabilities identified by Snyk should be triaged based on severity and impact
- Sonar findings should be reviewed and addressed where appropriate
- remediation work should be prioritised in line with service risk
