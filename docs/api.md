# Mattermost internals this plugin relies on

This file is the source of truth for the undocumented Mattermost webapp
behaviors Best Reply depends on. Every entry was verified against the
webapp bundle of a running server (v11.11.0, Entry Edition) and against
observed runtime behavior. **Re-verify this file when bumping the target
server version** — all of these are internal APIs and can change without
notice.

## Post DOM (center channel, RHS, search)

Verified from the `PostView` component in the client bundle.

| Element | Attribute | Value |
|---|---|---|
| Post container | `id` | `post_<id>` in the center channel, `rhsPost_<id>` in the RHS thread, `searchResult_<id>` in search results |
| Post container | `data-testid` | `postView` / `rhsPostView` — **contains no post id** |
| Message body | `class` | `post-message__text` |
| Message body | `data-testid` | `post-message-text` (lowercase, dashes, **no post id**) |

Consequences for selection quoting (`webapp/src/utils/selection.ts`):

- Post id extraction must walk **every attribute independently**. An earlier
  implementation checked `data-postid || data-post-id || data-testid || id`
  as a fallback chain; in v11 the container has both
  `data-testid="postView"` (no id inside) and `id="post_<id>"`, and the
  non-null `data-testid` shadowed the `id` — selection quoting silently
  broke for all posts. This was a real production bug.
- `data-testid="post-message-text"` matches the shape `post-message-<x>`.
  Any pattern of that form must validate the capture with
  `/^[a-z0-9]{26}$/i` — otherwise the literal `"text"` is mistaken for a
  post id.
- Post ids are 26 lowercase alphanumeric characters.

## Plugin registry

| Registry call | Expectation |
|---|---|
| `registerPostActionComponent` / `registerPostTypeComponent` / `registerRootComponent` | A **component type**, never a JSX element. Passing an element throws React error #130 and unmounts the whole Mattermost app. Guarded by `index.test.ts` (component typeof 'function'). |
| `registerMessageWillBePostedHook` | Synchronous transformation of the outgoing post. The returned object replaces the post before it is sent. Setting `type` to a custom value makes the server store the post under that type; the webapp renders it via `registerPostTypeComponent`. |
| `registerTranslations` | Key-value map merged into the webapp i18n dictionaries. Best Reply uses it to rename the native Reply action to "Thread" / "Тред" (`post_info.reply`, `post_info.comment_icon.tooltip.reply`). |

## Internal Redux actions (dispatched by string type)

Used to open/close the RHS thread panel without a Mattermost fork. All are
**undocumented and unstable**:

- `SELECT_POST` with `{postId, channelId, timestamp: 0}` — opens the RHS
  thread for the post; `postId: ''` closes it.
- `UPDATE_RHS_STATE` with `{state: null}` — resets the RHS panel state.
- `RECEIVED_POSTS` / `RECEIVED_POSTS_IN_THREAD` — pre-fill the store so the
  thread panel renders without waiting for its own fetch.

The plugin state lives under `plugins-<plugin-id>` in the global store
(`plugins-com.bestreply.plugin`).

## Global window objects

- `window.PostUtils.formatText(message, options)` and
  `window.PostUtils.messageHtmlToComponent(html, isRHS, options)` — markdown
  rendering identical to Mattermost's own. Used by the quoted-reply block.
- `window.WebappUtils.browserHistory` — client-side navigation used for
  permalink jumps (with a `window.location.assign` fallback).

## Composer DOM

- Center channel composer: `#post-create .AdvancedTextEditor [contenteditable="true"]` / `#post_textbox`.
- Thread composer (RHS): `.sidebar--right .AdvancedTextEditor [contenteditable="true"]`.
- Global Threads view: `.ThreadViewer .AdvancedTextEditor [contenteditable="true"]`.
- The composer is focused via `setTimeout(250ms)` after opening a thread —
  the panel is not mounted synchronously.

## Post shape produced by the plugin

Custom type: `custom_best_reply`. Props:

| Prop | Content |
|---|---|
| `best_reply_to` | post id of the quoted message (permalink target) |
| `best_reply_body` | reply text (used for rendering when the message was transformed) |
| `best_reply_text` | selected fragment, present only for selection-based quotes |

`message` always contains a mobile-safe markdown fallback:
`> **<author>**\n> <quote>\n\n<body>`. Web/desktop clients re-render the rich
block from props; mobile clients show the raw markdown.
