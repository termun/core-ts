# Release tooling

`semantic-release` and its plugins live here instead of the root `devDependencies`.

## Why

`@semantic-release/npm` depends on the `npm` CLI package, which ships its
dependencies as `bundleDependencies`. Two of them currently carry open
advisories:

| Package | Bundled in `npm` 11.21.2 | Advisory | Fixed in |
| --- | --- | --- | --- |
| `glob` | 13.0.6 | AbortSignal cancellation bypass (moderate) | 14.0.2 |
| `minimatch` | 10.2.5 | denial of service via globparts amplification (moderate) | 11.0.1 |

There is no way to fix them in place:

- `overrides` do not apply to `bundleDependencies` — npm restores them from the
  tarball, so the resolved versions are unchanged.
- No `npm` release bundles the patched versions yet: both `npm` 11.21.2 and
  `npm` 12.2.2 bundle `glob` ^13.0.6, and `@semantic-release/npm@13` requires
  `npm@^11.6.2`.
- `npm audit fix --force` downgrades to older `@semantic-release/npm` and `npm`
  majors, which trade these advisories for others.

Keeping the tooling out of the root tree lets `npm audit --audit-level=high`
in `ci.yml` gate the actual project dependencies without being permanently red
on an unfixable CI-only chain.

## How it works

`release.yml` installs this directory with `npm ci --prefix
.github/release-tools`, then runs `npx --prefix .github/release-tools
semantic-release` **from the repository root**. semantic-release resolves the
released package from `process.cwd()`, so the root `package.json`,
`CHANGELOG.md` and the `@semantic-release/git` assets behave exactly as they did
when the tooling was a root `devDependency`. Plugins resolve from this
directory's `node_modules`.

Versions are pinned by `package-lock.json` here and updated by Dependabot — see
the `/.github/release-tools` entry in `.github/dependabot.yml`.

`npm` is also listed here as a direct dependency, in the range
`@semantic-release/npm` accepts, so that a single copy is installed (`npm ls npm`
shows the plugin's one as `deduped`). Dependabot only bumps direct
dependencies: without this entry a new `npm` release would never reach the
lockfile until `@semantic-release/npm` itself is bumped. With it, the weekly
Dependabot run opens a pull request as soon as `npm` publishes a release, and
the advisories above close when that release bundles the fixed versions.

## Revisiting this

Once npm publishes a release that `@semantic-release/npm` accepts and that
bundles `glob >= 14.0.2` and `minimatch >= 11.0.1`, these packages can move back
into the root `devDependencies` and this directory can be deleted.
