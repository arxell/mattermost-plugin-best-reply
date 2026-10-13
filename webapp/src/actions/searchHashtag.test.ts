// @vitest-environment jsdom
import type {Store} from 'redux';
import {afterEach, describe, expect, it, vi} from 'vitest';

import {searchHashtag} from './searchHashtag';

const post = {id: 'post', user_id: 'author', channel_id: 'channel', message: '#release'};
const posts = {order: [post.id], posts: {[post.id]: post}};
const files = {order: [], file_infos: {}};
const response = (data: unknown) => ({ok: true, json: async () => data});
const makeState = () => ({entities: {
    general: {config: {SiteURL: 'https://chat.test/mm/'}},
    teams: {currentTeamId: 'team'},
    channels: {currentChannelId: 'channel', channels: {}},
    users: {profiles: {}},
},
views: {rhs: {rhsState: 'thread', selectedPostId: 'root', searchTerms: ''}}});

afterEach(() => vi.unstubAllGlobals());

describe('hashtag search', () => {
    it('loads search results and their authors/channels before opening native search', async () => {
        const state = makeState();
        const dispatch = vi.fn();
        document.cookie = 'MMCSRF=testcsrf';
        const fetch = vi.fn(async (url: string) => {
            if (url.endsWith('/posts/search')) {
                return response(posts);
            }
            if (url.endsWith('/files/search')) {
                return response(files);
            }
            if (url.endsWith('/users/ids')) {
                return response([{id: 'author'}]);
            }
            return response({id: 'channel'});
        });
        vi.stubGlobal('fetch', fetch);
        await searchHashtag({getState: () => state, dispatch} as unknown as Store, '#release');
        expect(fetch).toHaveBeenCalledWith('https://chat.test/mm/api/v4/teams/team/posts/search', expect.objectContaining({
            credentials: 'same-origin',
            headers: expect.objectContaining({'X-CSRF-Token': 'testcsrf'}),
            body: expect.stringContaining('"terms":"#release"'),
        }));
        expect(dispatch).toHaveBeenCalledWith({type: 'RECEIVED_POSTS', data: posts});
        expect(dispatch).toHaveBeenCalledWith({type: 'RECEIVED_CHANNEL', data: {id: 'channel'}});
        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({type: 'RECEIVED_SEARCH_TERM', data: expect.objectContaining({teamId: 'team', params: expect.objectContaining({page: 0, per_page: 20})})}));
        expect(dispatch.mock.lastCall?.[0]).toEqual({type: 'UPDATE_RHS_STATE', state: 'search'});
    });

    it('does not replace a different search opened during the request', async () => {
        let state = makeState();
        const dispatch = vi.fn();
        let finish!: (value: ReturnType<typeof response>) => void;
        vi.stubGlobal('fetch', vi.fn((url: string) => (url.endsWith('/posts/search') ? new Promise((resolve) => {
            finish = resolve;
        }) : Promise.resolve(response(files)))));
        const promise = searchHashtag({getState: () => state, dispatch} as unknown as Store, '#release');
        state = {...state, views: {rhs: {...state.views.rhs, searchTerms: '#different'}}};
        finish(response({order: [], posts: {}}));
        await promise;
        expect(dispatch).not.toHaveBeenCalled();
    });

    it('does not publish partial results after a request fails', async () => {
        const state = makeState();
        const dispatch = vi.fn();
        vi.stubGlobal('fetch', vi.fn(async () => ({ok: false, status: 403})));
        await expect(searchHashtag({getState: () => state, dispatch} as unknown as Store, '#release')).rejects.toThrow('403');
        expect(dispatch).not.toHaveBeenCalled();
    });

    it('opens message results when file search is disabled on the server', async () => {
        const state = makeState();
        const dispatch = vi.fn();
        vi.stubGlobal('fetch', vi.fn(async (url: string) => (url.endsWith('/files/search') ? {ok: false, status: 501} : response({order: [], posts: {}}))));
        await searchHashtag({getState: () => state, dispatch} as unknown as Store, '#release');
        expect(dispatch).toHaveBeenCalledWith({type: 'RECEIVED_SEARCH_POSTS', data: {order: [], posts: {}}, isGettingMore: false});
        expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({type: 'SEARCH_FILES_FAILURE'}));
        expect(dispatch.mock.lastCall?.[0]).toEqual({type: 'UPDATE_RHS_STATE', state: 'search'});
    });

    it('does not reopen search after another sidebar panel is selected', async () => {
        let state = makeState();
        const dispatch = vi.fn();
        let finish!: (value: ReturnType<typeof response>) => void;
        vi.stubGlobal('fetch', vi.fn((url: string) => (url.endsWith('/posts/search') ? new Promise((resolve) => {
            finish = resolve;
        }) : Promise.resolve(response(files)))));
        const promise = searchHashtag({getState: () => state, dispatch} as unknown as Store, '#release');
        state = {...state, views: {rhs: {...state.views.rhs, rhsState: 'channel-info'}}};
        finish(response({order: [], posts: {}}));
        await promise;
        expect(dispatch).not.toHaveBeenCalled();
    });
});
