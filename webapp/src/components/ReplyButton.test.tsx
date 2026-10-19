// @vitest-environment jsdom
import React from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {act} from 'react-dom/test-utils';
import {Provider} from 'react-redux';
import {createStore} from 'redux';
import {afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';

import type {Post} from '@mattermost/types/posts';
import type {GlobalState} from '@mattermost/types/store';

import ReplyButton from './ReplyButton';
import ReplyComposerPreview from './ReplyComposerPreview';

import {getPendingReply} from '../actions/reply';
import {COMPOSER_FOCUS_DELAY_MS, QUOTED_REPLY_POST_TYPE, THREAD_FETCH_PAGE_SIZE} from '../constants';
import reducer from '../reducers';
import {PLUGIN_STATE_KEY, type PluginState} from '../types/store';

let plugin: InstanceType<typeof import('../index').default>;
let root: Root;
let container: HTMLDivElement;

function makePost(overrides: Partial<Post> = {}): Post {
    return {
        id: 'source',
        channel_id: 'channel',
        user_id: 'author',
        root_id: '',
        message: 'Original message',
        props: {},
        delete_at: 0,
        reply_count: 0,
        ...overrides,
    } as Post;
}

function makeStore(post: Post, selectedPostId = '') {
    const initialState = {
        [PLUGIN_STATE_KEY]: {pendingReply: null},
        entities: {
            channels: {currentChannelId: post.channel_id},
            general: {config: {SiteURL: 'http://localhost', DefaultClientLocale: 'en'}},
            posts: {posts: {[post.id]: post}},
            users: {profiles: {}, currentUserId: 'me'},
        },
        views: {rhs: {selectedPostId, isSidebarOpen: Boolean(selectedPostId)}},
    } as unknown as GlobalState & {[PLUGIN_STATE_KEY]: PluginState};

    return createStore((state: typeof initialState = initialState, action) => ({
        ...state,
        [PLUGIN_STATE_KEY]: reducer(state[PLUGIN_STATE_KEY], action),
    }));
}

beforeAll(async () => {
    window.registerPlugin = vi.fn();
    const {default: Plugin} = await import('../index');
    plugin = new Plugin();
});

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    document.body.innerHTML = '<div id="post-create"><div class="AdvancedTextEditor__cell"><textarea id="post_textbox"></textarea></div></div><div class="sidebar--right"><div class="AdvancedTextEditor__cell"><textarea></textarea></div></div>';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
});

describe('Reply button thread routing', () => {
    it.each([
        {name: 'RHS thread reply', surface: 'sidebar--right', rootId: 'root', replyCount: 0, selectedPostId: 'root', opensThread: false},
        {name: 'global Threads reply', surface: 'ThreadViewer', rootId: 'root', replyCount: 0, selectedPostId: '', opensThread: false},
    ])('quotes a $name inside its source thread', async ({surface, rootId, replyCount, selectedPostId, opensThread}) => {
        const post = makePost({root_id: rootId, reply_count: replyCount});
        const expectedRootId = post.root_id || post.id;
        const store = makeStore(post, selectedPostId);
        const dispatch = vi.spyOn(store, 'dispatch');
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({order: [post.id], posts: {[post.id]: post}}),
        });
        vi.stubGlobal('fetch', fetchMock);

        const registry = {
            registerReducer: vi.fn(),
            registerTranslations: vi.fn(),
            registerRootComponent: vi.fn(),
            registerPostActionComponent: vi.fn(),
            registerPostTypeComponent: vi.fn(),
            registerPostDropdownMenuAction: vi.fn(),
            registerMessageWillBePostedHook: vi.fn(),
        };
        plugin.initialize(registry, store);
        const [hook] = registry.registerMessageWillBePostedHook.mock.calls[0] as [(outgoing: Post) => {post: Post}];

        if (surface === 'ThreadViewer') {
            const viewer = document.createElement('div');
            viewer.className = 'ThreadViewer';
            viewer.innerHTML = '<div class="AdvancedTextEditor__cell"><textarea></textarea></div>';
            document.body.appendChild(viewer);
            viewer.appendChild(container);
        } else if (surface === 'sidebar--right') {
            document.querySelector('.sidebar--right')!.appendChild(container);
        }

        await act(async () => {
            root.render(
                <Provider store={store}>
                    <ReplyButton post={post}/>
                    <ReplyComposerPreview/>
                </Provider>,
            );
        });
        await act(async () => {
            container.querySelector<HTMLButtonElement>('.quoted-reply-post-action')!.click();
        });

        const pendingReply = getPendingReply(store);
        expect(pendingReply).toEqual({
            context: 'thread',
            channelId: post.channel_id,
            rootId: expectedRootId,
            replyToPostId: post.id,
            selectedText: undefined,
        });
        if (opensThread) {
            expect(fetchMock).toHaveBeenCalledWith(`http://localhost/api/v4/posts/${expectedRootId}/thread?perPage=${THREAD_FETCH_PAGE_SIZE}`, expect.any(Object));
            expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({type: 'SELECT_POST', postId: expectedRootId, channelId: post.channel_id}));
        } else {
            expect(fetchMock).not.toHaveBeenCalled();
            expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({type: 'SELECT_POST'}));
        }
        expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({type: 'UPDATE_RHS_STATE'}));

        const composerSurface = surface === 'ThreadViewer' ? '.ThreadViewer' : '.sidebar--right';
        expect(document.querySelector(`${composerSurface} .quoted-reply-quote__message`)?.textContent).toBe(post.message);
        act(() => vi.advanceTimersByTime(COMPOSER_FOCUS_DELAY_MS));
        expect(document.activeElement).toBe(document.querySelector(`${composerSurface} textarea`));

        for (const outgoing of [
            makePost({message: 'Channel message'}),
            makePost({root_id: 'unrelated-thread', message: 'Other thread'}),
            makePost({channel_id: 'other-channel', root_id: expectedRootId}),
        ]) {
            expect(hook(outgoing).post).toBe(outgoing);
            expect(getPendingReply(store)).toEqual(pendingReply);
        }

        let converted: Post;
        act(() => {
            converted = hook(makePost({id: 'new-reply', root_id: expectedRootId, message: 'My reply'})).post;
        });
        expect(converted!).toMatchObject({
            root_id: expectedRootId,
            type: QUOTED_REPLY_POST_TYPE,
            message: '> **Unknown user**\n> Original message\n\nMy reply',
            props: {best_reply_to: post.id, best_reply_body: 'My reply'},
        });
        expect(getPendingReply(store)).toBeNull();
        expect(document.querySelector('.quoted-reply-composer-preview')).toBeNull();
    });
});

describe('Reply button channel routing', () => {
    it.each([
        {name: 'channel root with no replies', rootId: '', replyCount: 0, selectedPostId: ''},
        {name: 'channel root with existing replies', rootId: '', replyCount: 2, selectedPostId: 'other-root'},
        {name: 'thread reply shown in the channel', rootId: 'root', replyCount: 0, selectedPostId: ''},
        {name: 'channel post with its thread already open', rootId: '', replyCount: 2, selectedPostId: 'source'},
    ])('quotes a $name in the channel without opening a thread', async ({rootId, replyCount, selectedPostId}) => {
        const post = makePost({root_id: rootId, reply_count: replyCount});
        const store = makeStore(post, selectedPostId);
        const dispatch = vi.spyOn(store, 'dispatch');
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        const registry = {
            registerReducer: vi.fn(),
            registerTranslations: vi.fn(),
            registerRootComponent: vi.fn(),
            registerPostActionComponent: vi.fn(),
            registerPostTypeComponent: vi.fn(),
            registerPostDropdownMenuAction: vi.fn(),
            registerMessageWillBePostedHook: vi.fn(),
        };
        plugin.initialize(registry, store);
        const [hook] = registry.registerMessageWillBePostedHook.mock.calls[0] as [(outgoing: Post) => {post: Post}];

        await act(async () => {
            root.render(
                <Provider store={store}>
                    <ReplyButton post={post}/>
                    <ReplyComposerPreview/>
                </Provider>,
            );
        });
        await act(async () => {
            container.querySelector<HTMLButtonElement>('.quoted-reply-post-action')!.click();
        });

        const button = container.querySelector<HTMLButtonElement>('.quoted-reply-post-action')!;
        expect(button.textContent).toBe('Quote');
        expect(button.title).toBe('Reply with a quote here');

        expect(getPendingReply(store)).toEqual({
            context: 'channel',
            channelId: post.channel_id,
            rootId: '',
            replyToPostId: post.id,
            selectedText: undefined,
        });
        expect(fetchMock).not.toHaveBeenCalled();
        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({type: 'SELECT_POST', postId: ''}));
        expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({type: 'SELECT_POST', postId: post.root_id || post.id}));
        expect(document.querySelector('#post-create .quoted-reply-quote__message')?.textContent).toBe(post.message);
        expect(document.querySelector('.sidebar--right .quoted-reply-quote__message')).toBeNull();
        act(() => vi.advanceTimersByTime(COMPOSER_FOCUS_DELAY_MS));
        expect(document.activeElement).toBe(document.querySelector('#post_textbox'));

        let converted: Post;
        act(() => {
            converted = hook(makePost({id: 'new-reply', root_id: '', message: 'My reply'})).post;
        });
        expect(converted!).toMatchObject({
            root_id: '',
            type: QUOTED_REPLY_POST_TYPE,
            message: '> **Unknown user**\n> Original message\n\nMy reply',
            props: {best_reply_to: post.id, best_reply_body: 'My reply'},
        });
        expect(getPendingReply(store)).toBeNull();
    });
});
