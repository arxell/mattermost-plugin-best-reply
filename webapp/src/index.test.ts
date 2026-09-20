// @vitest-environment jsdom
import {beforeEach, describe, expect, it, vi} from 'vitest';

import type {Post} from '@mattermost/types/posts';

import {QUOTED_REPLY_POST_TYPE} from './constants';
import manifest from './manifest';
import {PLUGIN_STATE_KEY} from './types/store';
import type {PendingReply} from './types/store';

const registerPluginMock = vi.fn();

type Registry = {
    registerReducer: ReturnType<typeof vi.fn>;
    registerTranslations: ReturnType<typeof vi.fn>;
    registerRootComponent: ReturnType<typeof vi.fn>;
    registerPostActionComponent: ReturnType<typeof vi.fn>;
    registerPostDropdownMenuAction: ReturnType<typeof vi.fn>;
    registerPostTypeComponent: ReturnType<typeof vi.fn>;
    registerMessageWillBePostedHook: ReturnType<typeof vi.fn>;
};

function makeRegistry(): Registry {
    return {
        registerReducer: vi.fn(),
        registerTranslations: vi.fn(),
        registerRootComponent: vi.fn(),
        registerPostActionComponent: vi.fn(),
        registerPostTypeComponent: vi.fn(),
        registerPostDropdownMenuAction: vi.fn(),
        registerMessageWillBePostedHook: vi.fn(),
    };
}

function makeStore(pendingReply: PendingReply | null = null): {getState: () => unknown; dispatch: ReturnType<typeof vi.fn>} {
    return {
        getState: () => ({
            [PLUGIN_STATE_KEY]: {pendingReply},
            entities: {posts: {posts: {}}, users: {profiles: {}, currentUserId: 'me'}},
        }),
        dispatch: vi.fn(),
    };
}

async function importPlugin() {
    vi.resetModules();
    (window as unknown as Record<string, unknown>).registerPlugin = registerPluginMock;
    await import('./index');
    expect(registerPluginMock).toHaveBeenCalledTimes(1);

    const [pluginId, plugin] = registerPluginMock.mock.calls[0] as [string, {initialize: (registry: Registry, store: unknown) => void}];
    expect(pluginId).toBe(manifest.id);
    return plugin;
}

describe('plugin registration contract', () => {
    beforeEach(() => {
        registerPluginMock.mockClear();
    });

    it('registers itself under the manifest id with an initialize method', async () => {
        const plugin = await importPlugin();
        expect(typeof plugin.initialize).toBe('function');
    });

    it('registers every extension point with component types, not elements', async () => {
        const plugin = await importPlugin();
        const registry = makeRegistry();

        plugin.initialize(registry, makeStore());

        expect(registry.registerReducer).toHaveBeenCalledTimes(1);
        expect(registry.registerTranslations).toHaveBeenCalledTimes(1);
        expect(registry.registerRootComponent).toHaveBeenCalledTimes(3);
        expect(registry.registerPostActionComponent).toHaveBeenCalledTimes(1);
        expect(registry.registerPostTypeComponent).toHaveBeenCalledTimes(1);
        expect(registry.registerPostDropdownMenuAction).toHaveBeenCalledTimes(1);
        expect(registry.registerMessageWillBePostedHook).toHaveBeenCalledTimes(1);

        // Guard against React error #130: the registry must receive component
        // types. Elements are objects; components are functions/classes.
        const components = [
            ...registry.registerPostActionComponent.mock.calls.map((c) => c[0]),
            ...registry.registerPostTypeComponent.mock.calls.map((c) => c[1]),
            ...registry.registerRootComponent.mock.calls.map((c) => c[0]),
        ];
        for (const component of components) {
            expect(typeof component).toBe('function');
        }

        const [postType] = registry.registerPostTypeComponent.mock.calls[0] as [string, unknown];
        expect(postType).toBe(QUOTED_REPLY_POST_TYPE);
    });

    it('messageWillBePosted hook leaves posts untouched without a pending reply', async () => {
        const plugin = await importPlugin();
        const registry = makeRegistry();
        plugin.initialize(registry, makeStore());

        const [hook] = registry.registerMessageWillBePostedHook.mock.calls[0] as [(post: Post) => {post: Post}];
        const post = {id: 'p1', channel_id: 'ch1', message: 'hi'} as Post;
        expect(hook(post)).toEqual({post});
    });

    it('messageWillBePosted hook skips posts that do not match the pending reply', async () => {
        const plugin = await importPlugin();
        const registry = makeRegistry();
        const pendingReply: PendingReply = {
            replyToPostId: 'quoted',
            channelId: 'ch1',
            rootId: '',
            context: 'channel',
        };
        plugin.initialize(registry, makeStore(pendingReply));

        const [hook] = registry.registerMessageWillBePostedHook.mock.calls[0] as [(post: Post) => {post: Post}];

        // Different channel: untouched.
        const otherChannel = {id: 'p2', channel_id: 'other', message: 'hi'} as Post;
        expect(hook(otherChannel)).toEqual({post: otherChannel});

        // Channel context but the post is a thread reply: untouched.
        const threadReply = {id: 'p3', channel_id: 'ch1', root_id: 'root', message: 'hi'} as Post;
        expect(hook(threadReply)).toEqual({post: threadReply});
    });

    it('messageWillBePosted hook converts a matching post into a quoted reply', async () => {
        const plugin = await importPlugin();
        const registry = makeRegistry();
        const pendingReply: PendingReply = {
            replyToPostId: 'quoted',
            channelId: 'ch1',
            rootId: '',
            context: 'channel',
        };
        const store = makeStore(pendingReply);
        plugin.initialize(registry, store);

        const [hook] = registry.registerMessageWillBePostedHook.mock.calls[0] as [(post: Post) => {post: Post}];
        const post = {id: 'p4', channel_id: 'ch1', message: 'ответ'} as Post;
        const {post: converted} = hook(post);

        expect(converted.type).toBe(QUOTED_REPLY_POST_TYPE);
        expect(converted.props.best_reply_to).toBe('quoted');
        expect(converted.props.best_reply_body).toBe('ответ');

        // The pending reply is single-use: cleared after conversion.
        expect(store.dispatch).toHaveBeenCalledWith({type: expect.stringContaining('CLEAR_PENDING_REPLY')});
    });

    it('thread-context pending reply only matches posts in the same thread', async () => {
        const plugin = await importPlugin();
        const registry = makeRegistry();
        const pendingReply: PendingReply = {
            replyToPostId: 'quoted',
            channelId: 'ch1',
            rootId: 'root1',
            context: 'thread',
        };
        plugin.initialize(registry, makeStore(pendingReply));

        const [hook] = registry.registerMessageWillBePostedHook.mock.calls[0] as [(post: Post) => {post: Post}];

        // Another thread in the same channel: untouched.
        const otherThread = {id: 'p5', channel_id: 'ch1', root_id: 'other', message: 'hi'} as Post;
        expect(hook(otherThread)).toEqual({post: otherThread});

        // The matching thread reply: converted.
        const match = {id: 'p6', channel_id: 'ch1', root_id: 'root1', message: 'в тред'} as Post;
        expect(hook(match).post.type).toBe(QUOTED_REPLY_POST_TYPE);
    });
});
