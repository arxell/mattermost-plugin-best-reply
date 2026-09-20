import React from 'react';
import type {Store} from 'redux';

import type {GlobalState} from '@mattermost/types/store';
import type {Post} from '@mattermost/types/posts';

import manifest from './manifest';
import reducer from './reducers';
import ReplyButton from './components/ReplyButton';
import ReplyComposerPreview from './components/ReplyComposerPreview';
import QuotedReplyPost from './components/QuotedReplyPost';
import QuotedReplyStyles from './components/QuotedReplyStyles';
import SelectionQuoteButton from './components/SelectionQuoteButton';
import ErrorBoundary from './components/ErrorBoundary';
import {QUOTED_REPLY_POST_TYPE} from './constants';
import {buildQuotedReplyPost} from './utils/mobileQuote';
import {getTranslationsForLocale} from './i18n';
import {clearPendingReply, getPendingReply, startReplyToPost} from './actions/reply';
import {getPostFromStore, isReplyablePost} from './actions/openThread';

type PluginRegistry = {
    registerReducer: (reducerToRegister: typeof reducer) => void;
    registerPostActionComponent: (component: React.ComponentType<{post: Post}>) => string;
    registerPostDropdownMenuAction: (
        text: React.ReactNode,
        action: (postId: string) => void,
        filter?: (postId: string) => boolean,
    ) => string;
    registerRootComponent: (component: React.ComponentType) => string;
    registerPostTypeComponent: (type: string, component: React.ComponentType<{post: Post}>) => string;
    registerMessageWillBePostedHook: (
        hook: (post: Post) => {post: Post} | {error: {message: string}} | Promise<{post: Post} | {error: {message: string}}>,
    ) => string;
    registerTranslations: (getTranslationsForLocale: (locale: string) => Record<string, string>) => void;
};

// The registry expects component types, not elements (passing JSX here throws
// React #130 and unmounts the whole app); every component is additionally
// wrapped so a render crash degrades instead of propagating to Mattermost.
function wrapWithErrorBoundary<P extends {post: Post}>(Component: React.ComponentType<P>): React.ComponentType<P> {
    const Wrapped: React.FC<P> = (props) => (
        <ErrorBoundary>
            <Component {...props}/>
        </ErrorBoundary>
    );
    return Wrapped;
}

function wrapRootWithErrorBoundary(Component: React.ComponentType): React.ComponentType {
    const Wrapped: React.FC = () => (
        <ErrorBoundary>
            <Component/>
        </ErrorBoundary>
    );
    return Wrapped;
}

export default class Plugin {
    public initialize(registry: PluginRegistry, store: Store<GlobalState>): void {
        registry.registerReducer(reducer);
        registry.registerTranslations(getTranslationsForLocale);
        registry.registerRootComponent(QuotedReplyStyles);
        registry.registerRootComponent(wrapRootWithErrorBoundary(ReplyComposerPreview));
        registry.registerRootComponent(wrapRootWithErrorBoundary(SelectionQuoteButton));
        registry.registerPostActionComponent(wrapWithErrorBoundary(ReplyButton));
        registry.registerPostTypeComponent(QUOTED_REPLY_POST_TYPE, wrapWithErrorBoundary(QuotedReplyPost));

        registry.registerPostDropdownMenuAction(
            'Thread',
            (postId: string) => {
                const post = getPostFromStore(store, postId);
                if (post) {
                    void startReplyToPost(store, post, {context: 'thread'});
                }
            },
            (postId: string) => {
                const post = getPostFromStore(store, postId);
                return isReplyablePost(post);
            },
        );

        registry.registerMessageWillBePostedHook((post) => {
            const pendingReply = getPendingReply(store);

            if (!pendingReply) {
                return {post};
            }

            if (post.channel_id !== pendingReply.channelId) {
                return {post};
            }

            if (pendingReply.context === 'channel') {
                if (post.root_id) {
                    return {post};
                }
            } else if ((post.root_id || '') !== pendingReply.rootId) {
                return {post};
            }

            clearPendingReply(store);

            return {
                post: buildQuotedReplyPost(post, pendingReply, store),
            };
        });
    }
}

declare global {
    interface Window {
        registerPlugin: (pluginId: string, plugin: Plugin) => void;
    }
}

window.registerPlugin(manifest.id, new Plugin());
