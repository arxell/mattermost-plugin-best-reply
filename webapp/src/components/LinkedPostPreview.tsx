import React from 'react';
import {useSelector} from 'react-redux';

import type {Post, PostPreviewMetadata} from '@mattermost/types/posts';
import type {GlobalState} from '@mattermost/types/store';

import ErrorBoundary from './ErrorBoundary';
import ReplyQuote from './ReplyQuote';

import {getDisplayName, getQuotedPostDisplayMessage} from '../utils/posts';

declare global {
    interface Window {
        Components?: {PostMessagePreview?: React.ComponentType<{metadata: PostPreviewMetadata}>};
    }
}

export default function LinkedPostPreview({post, siteURL}: {post: Post; siteURL: string}) {
    const embed = post.metadata?.embeds?.[0];
    const data = embed?.type === 'permalink' ? embed.data : undefined;
    const preview = data && 'post_id' in data ? data : undefined;
    const cachedPost = useSelector((state: GlobalState) => (preview ? state.entities.posts?.posts[preview.post_id] : undefined));
    const target = preview?.post || cachedPost;
    const currentTeamName = useSelector((state: GlobalState) => {
        const teams = state.entities.teams;
        return teams?.teams[teams.currentTeamId]?.name;
    });
    const teamName = preview?.channel_type === 'D' || preview?.channel_type === 'G' ? currentTeamName : preview?.team_name;
    const user = useSelector((state: GlobalState) => (target ? state.entities.users.profiles[target.user_id] : undefined));
    if (!preview || !target || target.id !== preview.post_id || !(/^[a-z0-9]{26}$/).test(preview.post_id) ||
        typeof target.message !== 'string' || typeof teamName !== 'string' || !(/^[a-z0-9_-]+$/).test(teamName)) {
        return null;
    }
    const NativePreview = window.Components?.PostMessagePreview;

    // A custom post can link back to this reply; do not recursively render previews.
    if (NativePreview && typeof target.type === 'string' && !target.type.startsWith('custom_') && !target.props?.type) {
        return <ErrorBoundary><NativePreview metadata={preview}/></ErrorBoundary>;
    }

    // Mattermost 9 does not export PostMessagePreview; reuse the existing safe card.
    const path = `/${teamName}/pl/${preview.post_id}`;
    const href = `${siteURL.replace(/\/$/, '')}${path}`;
    return (
        <ReplyQuote
            post={target}
            username={getDisplayName(user)}
            user={user}
            permalink={href}
            onNavigate={() => {
                if (window.WebappUtils?.browserHistory) {
                    window.WebappUtils.browserHistory.push(path);
                } else {
                    window.location.assign(href);
                }
            }}
            quoteText={getQuotedPostDisplayMessage(target)}
            compact={true}
        />
    );
}
