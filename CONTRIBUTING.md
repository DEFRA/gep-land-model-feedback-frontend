# Contributing

Contributions are welcome. If you have an idea or have found a bug, please raise an issue before starting work on large changes.

When raising a bug, please fill out the issue template including what you did, what you expected to happen, and what happened instead.

## Branching

This project follows [Gitflow](https://defra.github.io/software-development-standards/guides/developer_workflows/#gitflow) with one difference: releases and hotfixes only merge into `main`. A workflow handles merging `main` back into `develop` automatically.

### Day-to-day work

Create feature branches from `develop` using kebab-case names, e.g. `feature/add-search-page` or `feature/GEP-123/add-search-page`. The task reference is optional. Open a PR targeting `develop`.

### Releases

1. Create a `release/X.Y` branch from `develop` (e.g. `release/0.1`)
2. Push the branch. The [Publish Release](.github/workflows/publish-release.yml) workflow builds, tests, tags, and opens a draft PR to `main` with generated release notes
3. Deploy the release artifact via the CDP portal and test it
4. Mark the PR ready for review. Once approved, merge to `main`
5. The [Auto Back-merge](.github/workflows/auto-back-merge.yml) workflow opens a PR to merge `main` back into `develop`. Review and merge it

> **Note:** Do not update the version in `package.json` manually. The release and hotfix workflows handle version bumping automatically.

### Hotfixes

1. Create a `hotfix/` branch from `main`
2. Open a PR targeting `main`
3. To build and deploy for testing, manually trigger the [Publish Hot Fix](.github/workflows/publish-hotfix.yml) workflow from the hotfix branch. This is intentionally manual so the fix can be reviewed before publishing. Each trigger produces a new patch version (e.g. `0.2.1`, `0.2.2`), so you can push more commits and re-trigger to test further fixes
4. Merge the PR to `main`
5. The back-merge workflow opens a PR to sync the fix to `develop`. Review and merge it

### Branch rules

Branch protection is enforced through repository rulesets. All changes to `develop`, `release/*` and `main` must go through a pull request with status checks passing. A [PR target check](.github/workflows/gitflow-pr-target-check.yml) validates that branches target the correct base:

- `feature/*`, `bugfix/*`, `hotfix/*`, `release/*`, `dependabot/*` can target `develop`
- `release/*`, `hotfix/*` can target `main`
- `main` can target `develop` (back-merge)

## Commit messages

This project follows the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification. Commit messages must be structured as:

```
<type>(<optional scope>): <description>
```

Common types: `feat`, `fix`, `build`, `chore`, `ci`, `docs`, `refactor`, `test`.

## Code style

Code style and formatting are enforced by [neostandard](https://github.com/neostandard/neostandard) via ESLint. SCSS is linted by [StyleLint](https://stylelint.io/) with the GDS config.

```bash
npm run lint          # Check for issues (read-only)
npm run format        # Auto-fix issues
```

## Submitting a pull request

A pre-commit hook runs the security audit, linter and tests automatically before each commit via [Husky](https://typicode.github.io/husky/).

- Give your PR a meaningful title and description

## Standards

This project follows:

- [Defra Software Development Standards](https://defra.github.io/software-development-standards/)
- [GOV.UK Design System](https://design-system.service.gov.uk/)
- [GDS Service Manual](https://www.gov.uk/service-manual)
