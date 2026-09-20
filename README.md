# Best Reply — Mattermost Plugin

Reply to a specific message **in the channel stream** or **in a thread** with a visible quote block — and quote **only the selected fragment** of a message when you need it.

Best Reply combines two plugins:

- the reply UX of [Azario16/mattermost-plugin-channel-reply](https://github.com/Azario16/mattermost-plugin-channel-reply) (Channel Reply) — Reply button, composer preview, clickable quote blocks, channel/thread contexts;
- the fragment quoting of [ZILosoft/mattermost-reply](https://github.com/ZILosoft/mattermost-reply) (Zilosoft Quote Reply) — select part of a message and quote just that fragment, with a Ctrl+Q hotkey.

## Features

- **Reply in channel** — reply to a root message from the main channel composer; the answer appears as a separate channel message with a quoted reference (does not open the thread sidebar).
- **Reply in thread** — reply from the thread sidebar or via **Thread** in the post menu; the answer stays in the thread.
- **Quote a fragment** — select part of a message and a small **Quote** popup appears above the selection (or press **Ctrl+Q**). The reply quotes only the selected fragment instead of the whole message.
- **Clickable quotes** — clicking a quote block navigates to the original message using Mattermost permalinks (scroll + highlight), including inside an open thread.
- **Quote UI** — quote bar with author and avatar, compact preview above the composer, up to 5 lines of quoted text.
- **Mobile fallback** — on native mobile clients the quoted reply is readable as a markdown blockquote with the author name and the quoted text (fragment if the reply was created from a selection). Creating quoted replies from the mobile app is not supported.

Fragments are capped at 500 characters (truncated with an ellipsis).

## How it works

The plugin is webapp-only (no server component). A pending reply is stored in
the plugin's Redux state and attached to the next matching post via the
`messageWillBePosted` hook. When the reply is sent:

- the post gets a custom type rendered as a rich quote block in the web/desktop client;
- the selected fragment is stored in the post props and used for both the rendered quote and the mobile markdown fallback;
- if the quoted post is missing (e.g. after a reload), the fragment is still rendered from the stored props.

## Requirements

- Mattermost **9.0+** (tested with 10.5.x)
- Node.js **18+** and npm (for building the webapp bundle)
- **Collapsed threads (CRT)** enabled on the Mattermost server

## Build

```bash
make dist
```

This installs webapp dependencies, builds `webapp/dist/main.js`, and creates:

```
dist/com.bestreply.plugin-1.0.0.tar.gz
```

Other commands:

```bash
make check    # install deps and run TypeScript type-check
make webapp   # build webapp only
make clean    # remove dist/ and node_modules/
```

## Install

### System Console

1. Open **System Console → Plugins → Plugin Management**
2. Set **Enable Plugins** and **Enable Uploads** to `true`
3. Click **Upload**, select the `.tar.gz` bundle from `dist/`
4. Enable **Best Reply**

### mmctl

```bash
mmctl plugin upload dist/com.bestreply.plugin-1.0.0.tar.gz
mmctl plugin enable com.bestreply.plugin
```

After installation, reload the Mattermost web client (hard refresh: **Ctrl+F5**).

## Server configuration

No plugin settings are required. For thread replies to work as intended:

- **System Console → Environment → Collapsed Threads** → `always_on`
- **Thread auto-follow** recommended

## Forking

If you publish your own fork, update the plugin ID in:

- `plugin.json`
- `webapp/src/manifest.ts`
- `webapp/src/types/store.ts` (`PLUGIN_STATE_KEY`)
- `Makefile`

Use a reverse-DNS ID you control, e.g. `com.example.best-reply`.

## Caveats

The plugin relies on Mattermost webapp internals (Redux actions, DOM class
names) — exact behavior may differ across Mattermost versions and clients.
Re-test after Mattermost upgrades.

Fragment quoting works on rendered message bodies (regular markdown posts).
Selecting text inside another quoted reply's custom block is not supported.

## Credits and licenses

This plugin is a derivative work:

- Base reply UX: [Azario16/mattermost-plugin-channel-reply](https://github.com/Azario16/mattermost-plugin-channel-reply) — MIT
- Fragment selection and popup: [ZILosoft/mattermost-reply](https://github.com/ZILosoft/mattermost-reply) — Apache License 2.0

See [NOTICE](NOTICE) for details. Licensed under the MIT License — see [LICENSE](LICENSE).

## Project layout

```
├── plugin.json       # Plugin manifest
├── Makefile          # Build & bundle
├── webapp/           # React/TypeScript source
│   ├── src/
│   │   ├── actions/    # reply/thread/navigation actions
│   │   ├── components/ # ReplyButton, SelectionQuoteButton, quotes, preview
│   │   ├── utils/      # posts, mobile quote fallback, selection helpers
│   │   └── ...
│   └── package.json
├── NOTICE
└── LICENSE
```
