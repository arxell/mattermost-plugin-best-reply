import type {Store} from 'redux';

import type {Post} from '@mattermost/types/posts';
import type {GlobalState} from '@mattermost/types/store';

import {getPostFromStore, openThreadForPost} from './openThread';

import {PERMALINK_FADEOUT_MS} from '../constants';
import {getPostFromState} from '../utils/posts';

const HIGHLIGHT_REPLY = 'HIGHLIGHT_REPLY';
const CLEAR_HIGHLIGHT_REPLY = 'CLEAR_HIGHLIGHT_REPLY';

// GlobalState covers entities.*, but views.rhs is webapp-internal and
// missing from the packaged @mattermost/types, so it stays a local
// extension (docs/api.md#internal-redux-actions).
type MattermostState = GlobalState & {
    views?: {
        rhs?: {
            selectedPostId?: string;
            isSidebarOpen?: boolean;
            highlightedPostId?: string;
        };
        rhsSuppressed?: boolean;
    };
};

function isPostInThread(post: Post, threadRootId: string): boolean {
    return post.id === threadRootId || post.root_id === threadRootId;
}

export function isThreadRhsOpen(state: MattermostState): boolean {
    return Boolean(
        state.views?.rhs?.isSidebarOpen &&
        !state.views?.rhsSuppressed &&
        state.views?.rhs?.selectedPostId,
    );
}

export function getOpenThreadRootId(state: MattermostState): string | null {
    return state.views?.rhs?.selectedPostId || null;
}

let highlightClearTimeout: number | undefined;

function scheduleHighlightClear(store: Store): void {
    if (highlightClearTimeout) {
        window.clearTimeout(highlightClearTimeout);
    }

    highlightClearTimeout = window.setTimeout(() => {
        store.dispatch({type: CLEAR_HIGHLIGHT_REPLY});
        highlightClearTimeout = undefined;
    }, PERMALINK_FADEOUT_MS);
}

function highlightPostInOpenThread(store: Store, postId: string): void {
    const state: MattermostState = store.getState();
    const currentHighlight = state.views?.rhs?.highlightedPostId;

    if (currentHighlight === postId) {
        store.dispatch({type: CLEAR_HIGHLIGHT_REPLY});
        window.requestAnimationFrame(() => {
            store.dispatch({type: HIGHLIGHT_REPLY, postId});
            scheduleHighlightClear(store);
        });
        return;
    }

    store.dispatch({type: HIGHLIGHT_REPLY, postId});
    scheduleHighlightClear(store);
}

function getRootPostId(post: Post): string {
    return post.root_id || post.id;
}

function tryNavigateWithinOpenThread(store: Store, post: Post): boolean {
    const state: MattermostState = store.getState();

    if (!isThreadRhsOpen(state)) {
        return false;
    }

    const threadRootId = getOpenThreadRootId(state);
    if (!threadRootId || !isPostInThread(post, threadRootId)) {
        return false;
    }

    highlightPostInOpenThread(store, post.id);
    return true;
}

async function tryOpenSameThreadReply(store: Store, post: Post, replyPost: Post): Promise<boolean> {
    const replyThreadRootId = getRootPostId(replyPost);
    if (!replyThreadRootId || !isPostInThread(post, replyThreadRootId)) {
        return false;
    }

    const currentThreadRootId = getOpenThreadRootId(store.getState());
    if (currentThreadRootId === replyThreadRootId) {
        highlightPostInOpenThread(store, post.id);
        return true;
    }

    // Open the thread in the RHS without switching the center channel.
    const opened = await openThreadForPost(store, post.id);
    if (opened) {
        highlightPostInOpenThread(store, post.id);
    }
    return opened;
}

function getSiteUrl(store: Store): string {
    const state: GlobalState = store.getState();
    return state.entities.general.config.SiteURL || window.location.origin;
}

function getTeamNameForPost(state: MattermostState, post: Post): string | null {
    const channel = state.entities.channels.channels[post.channel_id];
    const teamId = channel?.team_id || state.entities.teams.currentTeamId;
    const team = teamId ? state.entities.teams.teams[teamId] : undefined;

    return team?.name || null;
}

export function getPermalinkPath(state: MattermostState, postId: string): string | null {
    const post = getPostFromState(state, postId);
    if (!post) {
        return null;
    }

    const teamName = getTeamNameForPost(state, post);
    if (!teamName) {
        return null;
    }

    return `/${teamName}/pl/${postId}`;
}

export function getPermalinkUrl(store: Store, postId: string): string | null {
    const path = getPermalinkPath(store.getState(), postId);
    if (!path) {
        return null;
    }

    return `${getSiteUrl(store).replace(/\/$/, '')}${path}`;
}

export async function ensurePostLoaded(store: Store, postId: string): Promise<Post | undefined> {
    let post = getPostFromStore(store, postId) || getPostFromState(store.getState(), postId);
    if (post) {
        return post;
    }

    const response = await fetch(`${getSiteUrl(store)}/api/v4/posts/${postId}`, {
        credentials: 'same-origin',
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
        },
    });

    if (!response.ok) {
        return undefined;
    }

    post = await response.json();
    store.dispatch({
        type: 'RECEIVED_POST',
        data: post,
    });

    return post;
}

declare global {
    interface Window {
        WebappUtils?: {
            browserHistory: {
                push: (path: string) => void;
            };
        };
    }
}

type NavigateOptions = {

    // The reply post that was clicked. When it lives inside a thread and the
    // quoted post is part of the same thread, the current channel is kept and
    // the RHS thread panel is opened/highlighted instead of jumping to a
    // permalink.
    replyPost?: Post;
};

export async function navigateToQuotedPost(store: Store, postId: string, options?: NavigateOptions): Promise<boolean> {
    const post = await ensurePostLoaded(store, postId);
    if (!post) {
        return false;
    }

    if (options?.replyPost && await tryOpenSameThreadReply(store, post, options.replyPost)) {
        return true;
    }

    if (tryNavigateWithinOpenThread(store, post)) {
        return true;
    }

    const permalinkPath = getPermalinkPath(store.getState(), postId);
    if (!permalinkPath) {
        return false;
    }

    if (window.WebappUtils?.browserHistory) {
        window.WebappUtils.browserHistory.push(permalinkPath);
        return true;
    }

    window.location.assign(permalinkPath);
    return true;
}
