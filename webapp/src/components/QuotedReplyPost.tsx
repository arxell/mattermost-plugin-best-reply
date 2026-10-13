import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useSelector, useStore} from 'react-redux';

import type {Post} from '@mattermost/types/posts';
import type {GlobalState} from '@mattermost/types/store';
import type {Team} from '@mattermost/types/teams';

import LinkedPostPreview from './LinkedPostPreview';
import ReplyQuote from './ReplyQuote';

import {ensurePostLoaded, getPermalinkUrl, navigateToQuotedPost} from '../actions/navigateToPost';
import {searchHashtag} from '../actions/searchHashtag';
import {QUOTED_REPLY_PROP} from '../constants';
import {useTranslation} from '../i18n';
import {getPostFromState, getUserFromState, getDisplayName, getQuotedReplyBody, getQuotedFragment} from '../utils/posts';

type ChannelMention = string | {display_name: string; team_name?: string};

type PostFormatOptions = {
    postId?: string;
    editedAt?: number;
    atMentions?: boolean;
    channelId?: string;
    team?: Team;
    channelNamesMap?: Record<string, ChannelMention>;
    siteURL?: string;
    mentionKeys?: Array<{key: string}>;
};

declare global {
    interface Window {
        PostUtils: {
            formatText: (message: string, options?: PostFormatOptions) => string;
            messageHtmlToComponent: (html: string, isRHS?: boolean, options?: PostFormatOptions) => React.ReactNode;
        };
    }
}

type Props = {
    post: Post;
};

const QuotedReplyPost: React.FC<Props> = ({post}) => {
    const store = useStore();
    const t = useTranslation();
    const [searchError, setSearchError] = useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const replyToPostId = post.props?.[QUOTED_REPLY_PROP] as string | undefined;
    const quotedFragment = getQuotedFragment(post);
    const siteURL = useSelector((state: GlobalState) => state.entities.general?.config?.SiteURL || window.location.origin);
    const notifyChannel = useSelector((state: GlobalState) => state.entities.users.profiles[state.entities.users.currentUserId]?.notify_props?.channel === 'true');
    const channels = useSelector((state: GlobalState) => state.entities.channels?.channels);
    const team = useSelector((state: GlobalState) => {
        const channel = state.entities.channels?.channels[post.channel_id];
        const teamId = channel && (channel.team_id || state.entities.teams?.currentTeamId);
        return teamId ? state.entities.teams?.teams[teamId] : undefined;
    });
    const channelMentions = post.props?.channel_mentions;
    const channelNamesMap = useMemo(() => {
        const names = new Map<string, ChannelMention>(
            Object.values(channels || {}).filter((channel) => team && channel.team_id === team.id).
                map((channel) => [channel.name, channel.display_name]),
        );

        // Server metadata also resolves channels that have not been loaded locally.
        if (channelMentions && typeof channelMentions === 'object' && !Array.isArray(channelMentions)) {
            const validName = /^[a-z0-9._-]+$/;
            for (const [name, value] of Object.entries(channelMentions)) {
                if (!validName.test(name)) {
                    continue;
                }
                if (typeof value === 'string' && team) {
                    names.set(name, value);
                } else if (value && typeof value === 'object' &&
                    'display_name' in value && typeof value.display_name === 'string' &&
                    (!('team_name' in value) || (typeof value.team_name === 'string' && (!value.team_name || validName.test(value.team_name)))) &&
                    (team || ('team_name' in value && value.team_name))) {
                    names.set(name, value);
                }
            }
        }
        return Object.fromEntries(names);
    }, [channels, team, channelMentions]);

    const replyPost = useSelector((state: GlobalState) => {
        if (!replyToPostId) {
            return undefined;
        }
        return getPostFromState(state, replyToPostId);
    });

    const replyUser = useSelector((state: GlobalState) => {
        if (!replyPost) {
            return undefined;
        }
        return getUserFromState(state, replyPost.user_id);
    });

    useEffect(() => {
        if (replyToPostId && !replyPost) {
            // Keep the stored Markdown readable if the original cannot be fetched.
            ensurePostLoaded(store, replyToPostId).catch(() => undefined);
        }
    }, [replyToPostId, replyPost, store]);

    const permalink = replyToPostId && replyPost ? getPermalinkUrl(store, replyToPostId) : null;

    const handleQuoteClick = useCallback(() => {
        if (!replyToPostId) {
            return;
        }

        navigateToQuotedPost(store, replyToPostId, {replyPost: post, sourceElement: containerRef.current});
    }, [replyToPostId, store, post]);

    const replyBody = replyPost || quotedFragment ? getQuotedReplyBody(post) : post.message;
    const formattedBody = useMemo(() => {
        const formatOptions: PostFormatOptions = {
            postId: post.id,
            editedAt: post.edit_at || 0,
            atMentions: true,
            channelId: post.channel_id,
            team,
            channelNamesMap,
            siteURL,
            mentionKeys: notifyChannel ? [{key: '@channel'}, {key: '@all'}, {key: '@here'}] : [],
        };
        const formattedText = window.PostUtils.formatText(replyBody, formatOptions);

        return window.PostUtils.messageHtmlToComponent(formattedText, false, formatOptions);
    }, [post.edit_at, post.id, post.channel_id, replyBody, team, channelNamesMap, siteURL, notifyChannel]);

    const handleBodyClick = (event: React.MouseEvent<HTMLDivElement>) => {
        const link = event.target instanceof Element ? event.target.closest('a') : null;
        if (!link || !event.currentTarget.contains(link)) {
            return;
        }
        const hashtag = link.getAttribute('data-hashtag');
        if (hashtag) {
            event.preventDefault();
            event.stopPropagation();
            setSearchError(false);
            searchHashtag(store, hashtag).catch(() => setSearchError(true));
            return;
        }
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
            return;
        }
        const path = link.getAttribute('data-link');
        if (path?.startsWith('/') && !path.startsWith('//') && window.WebappUtils?.browserHistory) {
            event.preventDefault();
            event.stopPropagation();
            window.WebappUtils.browserHistory.push(path);
        }
    };

    return (
        <div
            className='quoted-reply-post'
            ref={containerRef}
        >
            {(replyPost || quotedFragment) && (
                <ReplyQuote
                    post={replyPost ?? post}
                    username={getDisplayName(replyUser)}
                    user={replyUser}
                    permalink={permalink}
                    onNavigate={handleQuoteClick}
                    compact={true}
                    quoteText={quotedFragment}
                />
            )}
            <div
                className='quoted-reply-post__body'
                onClick={handleBodyClick}
            >
                {formattedBody}
            </div>
            {searchError && <div role='alert'>{t('search_failed')}</div>}
            <LinkedPostPreview
                post={post}
                siteURL={siteURL}
            />
        </div>
    );
};

export default QuotedReplyPost;
