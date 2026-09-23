# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.4] - 2026-09-23

### Fixed

- The quote preview's close button no longer sits underneath the
  composer's floating preview toggle: the preview bar reserves the same
  top-right strip Mattermost's editor uses for its own actions.

## [1.2.3] - 2026-09-23

### Fixed

- Clicking a quote while reading a thread no longer hijacks the center
  panel. On the global threads page (followed threads) same-thread quotes
  highlight in place, and quotes pointing into another thread switch the
  viewer pane to that thread instead of leaving the page for a channel
  view. In the RHS thread panel, cross-thread quotes now open in the same
  panel instead of scrolling the center channel.

## [1.2.2] - 2026-09-22

### Fixed

- `@mentions` inside quoted replies are rendered as mention links again
  instead of plain text: the reply body is now formatted with
  `atMentions: true` (and the post's channel id, so the profile popover
  has channel context). Mention rendering part of #15, restored without
  the quote-click navigation change.

## [1.2.1] - 2026-09-22

### Fixed

- Selection quote popup is now rendered via a React portal directly into
  `<body>`, centered under the selection with a larger vertical gap, and forced
  to a fully opaque background so the underlying post text no longer shows
  through.

## [1.2.0] - 2026-09-22

### Added

- ESLint with the unified `plugin:@mattermost/react` config
  (`@mattermost/eslint-plugin`), wired into `make check-style`.
- `make coverage`, `make watch` and `make deploy` targets; the bundle now
  includes a plugin icon (`assets/icon.svg`).
- Dependabot: weekly updates for npm (`/webapp`) and GitHub Actions.

### Changed

- Toolchain: Node 24 via `.nvmrc` with `engines.node >=20`, exact pinned
  dependency versions (`save-exact`), TypeScript target ES2022, Babel
  config extracted to `babel.config.js` with modern browser targets and
  core-js polyfills, webpack mode driven by the `--mode` flag.
- The plugin version is derived from git tags
  (`webapp/scripts/sync-manifest.mjs` generates `webapp/src/manifest.ts`
  via `make apply`) instead of being hardcoded in three places.
- `react`/`react-dom`/`react-redux`/`redux` moved to devDependencies (they
  are webpack externals provided by the Mattermost webapp at runtime);
  `@mattermost/types` updated to 11.9.0.
- CI runs through the same make targets as the official Mattermost reusable
  plugin workflow (`check-style`/`test`/`dist`), the coverage badge follows
  the shared color thresholds, and the release job uses
  `gh release create --generate-notes`.
- README restructured to the unified layout (Features, Requirements,
  Installation, Development, Release process, Limitations, License).

### Internal

- `PluginRegistry` typings extracted to
  `webapp/src/types/mattermost-webapp/index.d.ts`.
- Hand-rolled partial Mattermost state types and umbrella casts replaced
  with `GlobalState` from `@mattermost/types`; the two remaining casts
  (internal `views.rhs` slice, plugin state slice) are annotated with
  pointers to `docs/api.md`.
- Magic numbers (composer focus delay, preview polling, highlight fadeout,
  thread page size, selection popup geometry) are named constants in
  `webapp/src/constants.ts`.
- `docs/api.md` now documents every internal dependency: string Redux
  actions, `views.rhs`, `window.PostUtils`/`window.WebappUtils`, composer
  and post DOM selectors, overridden core i18n keys, and timing constants.

## [1.1.0] - 2026-09-20

### Added

- Full localization of the plugin UI (Reply/Quote labels): English, Russian,
  French, German, driven by the user's Mattermost language with live
  re-rendering on change; dictionary symmetry enforced by tests.
- Unit test suite (vitest + jsdom): 53 tests covering selection extraction
  against the real PostView DOM, post/fragment utils, the mobile fallback
  builder, the reducer, i18n, and the `messageWillBePosted` hook matching
  rules.
- Registration contract test guarding against React error #130 (the registry
  must receive component types, never elements).
- `ErrorBoundary` around every registered component: a plugin render crash
  degrades to nothing instead of unmounting Mattermost.
- CI: type check, tests, bundle artifact, coverage badge pushed to the
  `coverage-badge` branch, and releases with attached bundles on `v*` tags.
- Documentation: README with screenshots and badges, `docs/api.md` with the
  verified Mattermost internals semantics, `AGENTS.md` with gotchas.

### Fixed

- Fragment quoting (selection popup and Ctrl+Q) did not work on Mattermost
  11.x: the post container's `data-testid="postView"` (which contains no id)
  shadowed `id="post_<id>"` in the attribute fallback chain. Every attribute
  is now matched independently.
- Post id pattern captures are validated against `/^[a-z0-9]{26}$/i`, so
  `data-testid="post-message-text"` is no longer mistaken for a post id.
- Plugin bundle could not be installed from macOS builds: Mattermost's
  extractor rejects the pax archives bsdtar writes by default; the Makefile
  now bundles with `--format=ustar`.
- The bundle assembly step ran from `webapp/` in CI instead of the repo
  root, where no Makefile exists.

## [1.0.0] - 2026-09-19

### Added

- Initial release: reply in channel or in thread with a quote block (base UX
  from Azario16/mattermost-plugin-channel-reply) and quoting of a selected
  fragment via popup or Ctrl+Q (from ZILosoft/mattermost-reply).
- Clickable quotes navigating to the original post via permalinks.
- Mobile markdown fallback embedded in the message body.

[1.2.0]: https://github.com/arxell/mattermost-plugin-best-reply/releases/tag/v1.2.0
[1.1.0]: https://github.com/arxell/mattermost-plugin-best-reply/releases/tag/v1.1.0
[1.0.0]: https://github.com/arxell/mattermost-plugin-best-reply/releases/tag/v1.0.0
