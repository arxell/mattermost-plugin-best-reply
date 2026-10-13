import type {Store} from 'redux';

import type {Post} from '@mattermost/types/posts';
import type {GlobalState} from '@mattermost/types/store';

import {getSiteUrl} from './navigateToPost';

import {SEARCH_PAGE_SIZE} from '../constants';
let latestRequest = 0;

type SearchState = GlobalState & {views?: {rhs?: {
    rhsState?: string | null;
    selectedPostId?: string;
    searchTerms?: string;
    searchTeam?: string;
};};};

export async function searchHashtag(store: Store, terms: string): Promise<void> {
    const request = ++latestRequest;
    const state: SearchState = store.getState();
    const teamId = state.views?.rhs?.searchTeam ?? state.entities.teams.currentTeamId;
    const siteURL = getSiteUrl(store).replace(/\/$/, '');
    const csrf = document.cookie.split('; ').find((cookie) => cookie.startsWith('MMCSRF='))?.slice(7);
    const headers = {'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...(csrf ? {'X-CSRF-Token': csrf} : {})};
    const params = {terms, is_or_search: false, include_deleted_channels: true, page: 0, per_page: SEARCH_PAGE_SIZE};
    const searchPath = teamId ? `/teams/${teamId}` : '';
    const read = async (path: string, body?: unknown) => {
        const response = await fetch(`${siteURL}/api/v4${path}`, {
            method: body ? 'POST' : 'GET',
            credentials: 'same-origin',
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!response.ok) {
            throw new Error(`Search failed: ${response.status}`);
        }
        return response.json();
    };
    let fileError: unknown;
    const [posts, files] = await Promise.all([
        read(`${searchPath}/posts/search`, params),
        read(`${searchPath}/files/search`, params).catch((error: unknown) => {
            fileError = error;
            return {order: [], file_infos: {}};
        }),
    ]);
    if (!Array.isArray(posts.order) || !posts.posts || typeof posts.posts !== 'object' ||
        !Array.isArray(files.order) || !files.file_infos || typeof files.file_infos !== 'object') {
        throw new Error('Invalid search response');
    }
    const results = Object.values(posts.posts) as Post[];
    const users = [...new Set(results.map((post) => post.user_id))].filter((id) => !state.entities.users.profiles[id]);
    const channels = [...new Set(results.map((post) => post.channel_id))].filter((id) => !state.entities.channels.channels[id]);
    const [profiles, loadedChannels] = await Promise.all([
        users.length ? read('/users/ids', users) : [],
        Promise.all(channels.map((id) => read(`/channels/${id}`))),
    ]);
    const current: SearchState = store.getState();

    // A later search or navigation must not be overwritten by a slow response.
    if (request !== latestRequest || current.entities.teams.currentTeamId !== state.entities.teams.currentTeamId ||
        current.entities.channels.currentChannelId !== state.entities.channels.currentChannelId ||
        current.views?.rhs?.searchTerms !== state.views?.rhs?.searchTerms ||
        current.views?.rhs?.searchTeam !== state.views?.rhs?.searchTeam ||
        current.views?.rhs?.selectedPostId !== state.views?.rhs?.selectedPostId ||
        current.views?.rhs?.rhsState !== state.views?.rhs?.rhsState) {
        return;
    }

    store.dispatch({type: 'RECEIVED_PROFILES', data: profiles});
    for (const channel of loadedChannels) {
        store.dispatch({type: 'RECEIVED_CHANNEL', data: channel});
    }
    store.dispatch({type: 'RECEIVED_POSTS', data: posts});
    store.dispatch({type: 'RECEIVED_FILES_FOR_SEARCH', data: files.file_infos});
    store.dispatch({type: 'RECEIVED_SEARCH_POSTS', data: posts, isGettingMore: false});
    store.dispatch({type: 'RECEIVED_SEARCH_FILES', data: files, isGettingMore: false});
    store.dispatch({type: 'RECEIVED_SEARCH_TERM', data: {teamId, params, isEnd: posts.order.length === 0, isFilesEnd: files.order.length === 0}});
    store.dispatch({type: 'SEARCH_POSTS_SUCCESS'});
    store.dispatch(fileError ? {type: 'SEARCH_FILES_FAILURE', error: fileError} : {type: 'SEARCH_FILES_SUCCESS'});
    store.dispatch({type: 'UPDATE_RHS_SEARCH_TERMS', terms});
    store.dispatch({type: 'UPDATE_RHS_SEARCH_RESULTS_TERMS', terms});
    store.dispatch({type: 'UPDATE_RHS_SEARCH_TYPE', searchType: 'messages'});
    store.dispatch({type: 'UPDATE_RHS_SEARCH_RESULTS_TYPE', searchType: 'messages'});
    store.dispatch({type: 'UPDATE_RHS_STATE', state: 'search'});
}
