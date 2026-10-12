// @vitest-environment jsdom
import React from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {act} from 'react-dom/test-utils';
import {Provider, useSelector} from 'react-redux';
import {createStore} from 'redux';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import type {Post} from '@mattermost/types/posts';

import ReplyComposerPreview from './ReplyComposerPreview';

import {clearPendingReply, getPendingReply, setPendingReply, startReplyToPost} from '../actions/reply';
import reducer from '../reducers';
import {PLUGIN_STATE_KEY, type PendingReply} from '../types/store';

const source = {id: 'next-root', root_id: '', channel_id: 'channel', user_id: 'author', message: 'New quote', delete_at: 0} as Post;
const oldReply: PendingReply = {replyToPostId: 'old-root', rootId: 'old-root', channelId: 'channel', context: 'thread'};
let root: Root;
let finishFetch: (response: Response) => void;

function makeStore(hasOldQuote = false) {
    const initial = {
        [PLUGIN_STATE_KEY]: {pendingReply: hasOldQuote ? oldReply : null as PendingReply | null},
        entities: {
            general: {config: {SiteURL: 'http://localhost'}},
            channels: {currentChannelId: 'channel'},
            posts: {posts: {[source.id]: source, 'old-root': {...source, id: 'old-root', message: 'Old quote'}}},
            users: {profiles: {author: {id: 'author', username: 'author'}}},
        },
        views: {rhs: {selectedPostId: 'old-root', isSidebarOpen: true}},
    };
    return createStore((state: typeof initial = initial, action: {type: string; postId?: string}) => ({
        ...state,
        [PLUGIN_STATE_KEY]: reducer(state[PLUGIN_STATE_KEY], action),
        views: action.type === 'SELECT_POST' ? {rhs: {selectedPostId: action.postId || '', isSidebarOpen: Boolean(action.postId)}} : state.views,
    }));
}

// Mattermost replaces the composer when SELECT_POST changes the viewed root.
function ThreadComposer() {
    const id = useSelector((state: ReturnType<ReturnType<typeof makeStore>['getState']>) => state.views.rhs.selectedPostId);
    if (!id) {
        return null;
    }
    return (
        <div
            className='sidebar--right'
            key={id}
        >
            <div
                className='AdvancedTextEditor__cell'
                data-root={id}
            >
                <textarea/>
            </div>
        </div>
    );
}

async function render(store: ReturnType<typeof makeStore>) {
    await act(async () => root.render(<Provider store={store}><ThreadComposer/><ReplyComposerPreview/></Provider>));
}

function fetchedThread(ok = true): Response {
    return {ok, status: ok ? 200 : 500, json: async () => ({order: [source.id], posts: {[source.id]: source}})} as Response;
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => {
        finishFetch = resolve;
    })));
    document.body.innerHTML = '<div id="app"></div>';
    root = createRoot(document.getElementById('app')!);
});

afterEach(async () => {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
    vi.useRealTimers();
    document.body.innerHTML = '';
});

describe('switching the quoted thread', () => {
    it.each([false, true])('keeps the new quote when the old composer is replaced (old quote: %s)', async (hasOldQuote) => {
        const store = makeStore(hasOldQuote);
        await render(store);
        const oldComposer = document.querySelector('.AdvancedTextEditor__cell')!;
        let opening: Promise<boolean>;
        await act(async () => {
            opening = startReplyToPost(store, source, {context: 'thread'});
        });
        expect(oldComposer.querySelector('.quoted-reply-composer-preview')).toBeNull();
        await act(async () => {
            finishFetch(fetchedThread());
            await opening;
        });
        expect(oldComposer.isConnected).toBe(false);
        expect(getPendingReply(store)).toMatchObject({replyToPostId: source.id, rootId: source.id});
        expect(document.querySelector('[data-root="next-root"] .quoted-reply-quote__message')?.textContent).toBe('New quote');
        await act(async () => store.dispatch({type: 'SELECT_POST', postId: ''}));
        expect(getPendingReply(store)).toBeNull();
    });

    it('does not restore a quote cancelled while the thread request was in flight', async () => {
        const store = makeStore();
        await render(store);
        let opening: Promise<boolean>;
        await act(async () => {
            opening = startReplyToPost(store, source, {context: 'thread'});
        });
        await act(async () => clearPendingReply(store));
        await act(async () => {
            finishFetch(fetchedThread());
            await opening;
        });
        expect(getPendingReply(store)).toBeNull();
        expect(document.querySelector('.quoted-reply-composer-preview')).toBeNull();
    });

    it('clears the waiting quote when fetching the thread fails', async () => {
        const store = makeStore();
        await render(store);
        let opening: Promise<boolean>;
        await act(async () => {
            opening = startReplyToPost(store, source, {context: 'thread'});
        });
        await act(async () => {
            const rejected = expect(opening!).rejects.toThrow('API request failed: 500');
            finishFetch(fetchedThread(false));
            await rejected;
        });
        expect(getPendingReply(store)).toBeNull();
        expect(document.querySelector('.quoted-reply-composer-preview')).toBeNull();
    });

    it.each([true, false])('does not replace a newer quote when an older fetch completes (success: %s)', async (ok) => {
        const store = makeStore();
        await render(store);
        let opening: Promise<boolean>;
        await act(async () => {
            opening = startReplyToPost(store, source, {context: 'thread'});
        });
        await act(async () => setPendingReply(store, oldReply));
        await act(async () => {
            const result = ok ? expect(opening!).resolves.toBe(false) : expect(opening!).rejects.toThrow('API request failed: 500');
            finishFetch(fetchedThread(ok));
            await result;
        });
        expect(getPendingReply(store)).toBe(oldReply);
    });
});
