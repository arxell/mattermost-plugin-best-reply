import type {Store} from 'redux';

import type {Post} from '@mattermost/types/posts';
import type {GlobalState} from '@mattermost/types/store';

import {getPostFromStore} from './openThread';

import {getPostFromState} from '../utils/posts';

const HIGHLIGHT_REPLY = 'HIGHLIGHT_REPLY';
const CLEAR_HIGHLIGHT_REPLY = 'CLEAR_HIGHLIGHT_REPLY';
const PERMALINK_FADEOUT_MS = 5000;

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

export async function navigateToQuotedPost(store: Store, postId: string): Promise<boolean> {
    const post = await ensurePostLoaded(store, postId);
    if (!post) {
        return false;
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
