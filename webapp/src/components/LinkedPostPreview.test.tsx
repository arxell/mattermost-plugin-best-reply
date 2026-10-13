// @vitest-environment jsdom
import React from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {act} from 'react-dom/test-utils';
import {Provider} from 'react-redux';
import {createStore} from 'redux';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';

import type {Post} from '@mattermost/types/posts';

import LinkedPostPreview from './LinkedPostPreview';

const target = {id: 'a'.repeat(26), user_id: 'user', message: 'Release approved', type: '', props: {}} as Post;
const metadata = {post_id: target.id, post: target, team_name: 'audit', channel_display_name: 'Release', channel_type: 'O', channel_id: 'c'.repeat(26)};
let root: Root;

beforeEach(() => {
    Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});
    document.body.innerHTML = '<div id="app"></div>';
    root = createRoot(document.getElementById('app')!);
    window.Components = {};
    window.WebappUtils = {browserHistory: {push: vi.fn()}};
});
afterEach(async () => {
    await act(async () => root.unmount());
    delete window.Components;
});

async function render(data: unknown = metadata) {
    const post = {metadata: {embeds: [{type: 'permalink', data}]}} as Post;
    const store = createStore(() => ({entities: {teams: {currentTeamId: 'team', teams: {team: {name: 'audit'}}}, users: {profiles: {user: {id: 'user', username: 'author'}}}}}));
    await act(async () => {
        root.render(
            <Provider store={store}>
                <LinkedPostPreview
                    post={post}
                    siteURL='https://chat.test/mm'
                />
            </Provider>,
        );
    });
}

it('uses the native preview when exported by Mattermost', async () => {
    const Native = vi.fn<(props: {metadata: unknown}) => React.ReactElement>(() => <div>{'Native preview'}</div>);
    window.Components = {PostMessagePreview: Native};
    await render();
    expect(Native.mock.calls[0][0]).toMatchObject({metadata});
    expect(document.body.textContent).toBe('Native preview');
});

it('uses an existing navigable quote card on Mattermost 9', async () => {
    await render();
    expect(document.body.textContent).toContain('Release approved');
    expect(document.querySelector('a')?.href).toBe(`https://chat.test/mm/audit/pl/${target.id}`);
    document.querySelector('a')!.click();
    expect(window.WebappUtils!.browserHistory.push).toHaveBeenCalledWith(`/audit/pl/${target.id}`);
});

it('does not recursively render custom posts inside a preview', async () => {
    const Native = vi.fn(() => null);
    window.Components = {PostMessagePreview: Native};
    await render({...metadata, post: {...target, type: 'custom_best_reply'}});
    expect(Native).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Release approved');
});

it('ignores malformed metadata without constructing unsafe links', async () => {
    await render({...metadata, team_name: '//outside.test'});
    expect(document.querySelector('a')).toBeNull();
});

it('uses the selected team for a direct-message preview', async () => {
    await render({...metadata, team_name: '', channel_type: 'D'});
    expect(document.querySelector('a')?.href).toBe(`https://chat.test/mm/audit/pl/${target.id}`);
});
