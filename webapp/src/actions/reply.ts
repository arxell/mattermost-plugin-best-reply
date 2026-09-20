import type {Store} from 'redux';

import type {Post} from '@mattermost/types/posts';

import {getOpenThreadRootId, isThreadRhsOpen} from './navigateToPost';
import {openThreadForPost} from './openThread';

import {CLEAR_PENDING_REPLY, PLUGIN_STATE_KEY, SET_PENDING_REPLY, type PendingReply, type ReplyContext} from '../types/store';
import {normalizeQuotedFragment} from '../utils/selection';

type MattermostState = Parameters<typeof isThreadRhsOpen>[0];

function getRootPostId(post: Post): string {
    return post.root_id || post.id;
}

function closeRhs(store: Store): void {
    store.dispatch({
        type: 'UPDATE_RHS_STATE',
        state: null,
    });
    store.dispatch({
        type: 'SELECT_POST',
        postId: '',
        channelId: '',
        timestamp: 0,
    });
}

function getThreadComposerSelectors(element?: HTMLElement): string[] {
    if (element?.closest('.ThreadViewer') && !element.closest('.sidebar--right')) {
        return [
            '.ThreadViewer .AdvancedTextEditor [contenteditable="true"]',
            '.ThreadViewer textarea',
        ];
    }

    return [
        '.sidebar--right .AdvancedTextEditor [contenteditable="true"]',
        '.sidebar--right textarea',
        '.ThreadViewer .AdvancedTextEditor [contenteditable="true"]',
        '.ThreadViewer textarea',
    ];
}

function focusComposer(context: ReplyContext, element?: HTMLElement): void {
    const selectors = context === 'thread' ? getThreadComposerSelectors(element) : [
        '#post-create .AdvancedTextEditor [contenteditable="true"]',
        '#post_textbox',
        'textarea#post_textbox',
    ];

    window.setTimeout(() => {
        for (const selector of selectors) {
            const element = document.querySelector(selector) as HTMLElement | null;
            if (element) {
                element.focus();
                break;
            }
        }
    }, 250);
}

export function setPendingReply(store: Store, pendingReply: PendingReply | null): void {
    store.dispatch({
        type: SET_PENDING_REPLY,
        data: pendingReply,
    });
}

export function clearPendingReply(store: Store): void {
    store.dispatch({
        type: CLEAR_PENDING_REPLY,
    });
}

export function getPendingReply(store: Store): PendingReply | null {
    const state = store.getState() as Record<string, {pendingReply: PendingReply | null} | undefined>;
    return state[PLUGIN_STATE_KEY]?.pendingReply || null;
}

export function isReplyInThreadView(element: HTMLElement): boolean {
    return Boolean(element.closest('.sidebar--right, .ThreadViewer'));
}

function isInGlobalThreadViewer(element?: HTMLElement): boolean {
    return Boolean(element?.closest('.ThreadViewer') && !element.closest('.sidebar--right'));
}

function isThreadPanelAlreadyOpen(store: Store, post: Post, element?: HTMLElement): boolean {
    if (isInGlobalThreadViewer(element)) {
        return true;
    }

    const state = store.getState() as MattermostState;
    const rootId = getRootPostId(post);

    return isThreadRhsOpen(state) && getOpenThreadRootId(state) === rootId;
}

type StartReplyOptions = {
    context: ReplyContext;
    element?: HTMLElement;
    selectedText?: string;
};

export async function startReplyToPost(
    store: Store,
    post: Post,
    options: StartReplyOptions,
): Promise<boolean> {
    const {context, element} = options;
    const pendingReply: PendingReply = {
        replyToPostId: post.id,
        channelId: post.channel_id,
        rootId: context === 'thread' ? getRootPostId(post) : '',
        context,
        selectedText: options.selectedText ? normalizeQuotedFragment(options.selectedText) : undefined,
    };

    setPendingReply(store, pendingReply);

    if (context === 'thread') {
        if (!isThreadPanelAlreadyOpen(store, post, element)) {
            const opened = await openThreadForPost(store, post.id);
            focusComposer('thread', element);
            return opened;
        }

        focusComposer('thread', element);
        return true;
    }

    closeRhs(store);
    focusComposer('channel');

    return true;
}
