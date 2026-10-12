// @vitest-environment jsdom
import React from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {act} from 'react-dom/test-utils';
import {Provider} from 'react-redux';
import {createStore} from 'redux';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import type {Post} from '@mattermost/types/posts';
import type {GlobalState} from '@mattermost/types/store';

import QuotedReplyPost from './QuotedReplyPost';

const {loadPost, permalink} = vi.hoisted(() => ({loadPost: vi.fn(), permalink: vi.fn()}));
vi.mock('../actions/navigateToPost', () => ({
    ensurePostLoaded: loadPost,
    getPermalinkUrl: permalink,
    navigateToQuotedPost: vi.fn(),
}));

let root: Root;
const reply = {id: 'reply', channel_id: 'channel', message: '> **author**\n> Original text\n\nMy answer', type: 'custom_best_reply', props: {best_reply_to: 'source', best_reply_body: 'My answer'}} as unknown as Post;

beforeEach(() => {
    Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
    document.body.innerHTML = '<div id="app"></div>';
    root = createRoot(document.getElementById('app')!);
    loadPost.mockReset().mockResolvedValue(undefined);
    permalink.mockReset().mockImplementation((store) => (store.getState().entities.posts.posts.source ? '/audit/pl/source' : null));
    window.PostUtils = {formatText: (text) => text, messageHtmlToComponent: (html) => html};
});

afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = '';
});

describe('unloaded quote originals', () => {
    it('shows the stored fallback until the original is loaded, then restores the link', async () => {
        const initial = {entities: {posts: {posts: {}}, users: {profiles: {author: {id: 'author', username: 'author'}}}}} as unknown as GlobalState;
        const store = createStore((state: GlobalState = initial, action: {type: string; data?: Post}) => (action.data ? {
            ...state,
            entities: {...state.entities, posts: {...state.entities.posts, posts: {[action.data.id]: action.data}}},
        } : state));
        await act(async () => root.render(<Provider store={store}><QuotedReplyPost post={reply}/></Provider>));
        expect(document.body.textContent).toContain('Original text');
        expect(loadPost).toHaveBeenCalledWith(store, 'source');
        await act(async () => store.dispatch({type: 'RECEIVED_POST', data: {id: 'source', user_id: 'author', message: 'Original text'} as Post}));
        expect(document.querySelector('a')?.getAttribute('href')).toBe('/audit/pl/source');
        expect(document.body.textContent?.match(/Original text/g)).toHaveLength(1);
    });

    it('keeps readable content when fetching the original fails', async () => {
        loadPost.mockRejectedValue(new Error('offline'));
        const state = {entities: {posts: {posts: {}}, users: {profiles: {}}}} as unknown as GlobalState;
        const store = createStore(() => state);
        await act(async () => root.render(<Provider store={store}><QuotedReplyPost post={reply}/></Provider>));
        expect(document.body.textContent).toContain('Original text');
        expect(document.body.textContent).toContain('My answer');
    });
});

describe('channel mentions in reply bodies', () => {
    const team = {id: 'team', name: 'audit', display_name: 'Audit'};
    const otherTeam = {id: 'other', name: 'other-team', display_name: 'Other'};
    const channel = {id: 'channel', team_id: team.id, name: 'review', display_name: 'Review'};
    const target = {id: 'target', team_id: team.id, name: 'release-planning', display_name: 'Планирование выпуска'};

    function makeState() {
        return {entities: {
            posts: {posts: {}},
            users: {profiles: {}},
            channels: {channels: {channel, target, foreign: {...target, id: 'foreign', team_id: otherTeam.id, display_name: 'Wrong team'}}},
            teams: {currentTeamId: otherTeam.id, teams: {team, other: otherTeam}},
        }} as unknown as GlobalState;
    }

    async function renderReply(state: GlobalState, mentions?: unknown) {
        const post = {...reply, message: 'Обсудим в ~release-planning.', props: {channel_mentions: mentions}};
        const formatText = vi.fn<typeof window.PostUtils.formatText>((text) => text);
        window.PostUtils.formatText = formatText;
        const store = createStore((previous = state, action: {type: string; state?: GlobalState}) => action.state || previous);
        await act(async () => root.render(<Provider store={store}><QuotedReplyPost post={post}/></Provider>));
        return {store, formatText};
    }

    it('formats legacy mentions in the post team, even when another team is selected', async () => {
        const {formatText} = await renderReply(makeState());
        expect(formatText).toHaveBeenLastCalledWith('Обсудим в ~release-planning.', expect.objectContaining({
            team,
            channelNamesMap: {review: 'Review', 'release-planning': 'Планирование выпуска'},
            channelId: 'channel',
            atMentions: true,
        }));
    });

    it('prefers server channel metadata and supports a channel absent from the local cache', async () => {
        const remote = {display_name: 'Другой канал', team_name: 'remote-team'};
        const {formatText} = await renderReply(makeState(), {'release-planning': remote, unloaded: remote});
        expect(formatText.mock.lastCall?.[1]).toMatchObject({channelNamesMap: {'release-planning': remote, unloaded: remote}});
    });

    it('uses the selected team for a direct-message channel', async () => {
        const state = makeState();
        state.entities.channels.channels.channel = {...state.entities.channels.channels.channel, team_id: ''};
        const {formatText} = await renderReply(state);
        expect(formatText.mock.lastCall?.[1]).toMatchObject({team: otherTeam, channelNamesMap: {'release-planning': 'Wrong team'}});
    });

    it('reformats when channel data arrives or a display name changes', async () => {
        const state = makeState();
        delete state.entities.channels.channels.target;
        const {store, formatText} = await renderReply(state);
        const updated = makeState();
        updated.entities.channels.channels.target = {...target, display_name: 'Новое название'} as never;
        await act(async () => store.dispatch({type: 'RECEIVED_CHANNEL', state: updated}));
        expect(formatText.mock.lastCall?.[1]).toMatchObject({channelNamesMap: {'release-planning': 'Новое название'}});
    });

    it.each([
        [null], ['invalid'], [[]],
        [{broken: null, bad: {display_name: 42}, wrongteam: {display_name: 'Invalid', team_name: 42}}],
        [{hasOwnProperty: 'Invalid', 'bad"name': 'Invalid', badteam: {display_name: 'Invalid', team_name: 'bad"team'}}],
    ])('ignores malformed metadata without losing the reply: %j', async (mentions) => {
        const {formatText} = await renderReply(makeState(), mentions);
        expect(formatText.mock.lastCall?.[1]?.channelNamesMap).toEqual({review: 'Review', 'release-planning': 'Планирование выпуска'});
        expect(document.body.textContent).toContain('Обсудим в ~release-planning.');
    });

    it('keeps only self-contained mentions when team context is unavailable', async () => {
        const state = {entities: {posts: {posts: {}}, users: {profiles: {}}}} as unknown as GlobalState;
        const remote = {display_name: 'Канал', team_name: 'audit'};
        const {formatText} = await renderReply(state, {remote, legacy: 'No team', missingTeam: {display_name: 'No team'}});
        expect(formatText.mock.lastCall?.[1]).toMatchObject({channelNamesMap: {remote}});
    });

    it('does not guess the team of a post whose channel is not loaded', async () => {
        const state = makeState();
        delete state.entities.channels.channels.channel;
        const {formatText} = await renderReply(state);
        expect(formatText.mock.lastCall?.[1]?.team).toBeUndefined();
        expect(formatText.mock.lastCall?.[1]?.channelNamesMap).toEqual({});
    });
});
