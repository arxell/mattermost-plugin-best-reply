import React from 'react';
import {useStore} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {isReplyablePost} from '../actions/openThread';
import {startReplyToPost, isReplyInThreadView} from '../actions/reply';
import {useTranslation} from '../i18n';

type Props = {
    post: Post;
};

// Quotation marks keep the button visually distinct from the native reply arrow next to it.
const QuoteIcon = () => (
    <svg
        width='18'
        height='18'
        viewBox='0 0 24 24'
        fill='none'
        aria-hidden='true'
    >
        <path
            d='M5 7h6v6l-2 4H6.5l2-4H5V7Zm8 0h6v6l-2 4h-2.5l2-4H13V7Z'
            fill='currentColor'
        />
    </svg>
);

const ReplyButton: React.FC<Props> = ({post}) => {
    const store = useStore();
    const t = useTranslation();

    if (!isReplyablePost(post)) {
        return null;
    }

    const handleClick = (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();

        const context = isReplyInThreadView(event.currentTarget as HTMLElement) ? 'thread' : 'channel';
        startReplyToPost(store, post, {
            context,
            element: event.currentTarget as HTMLElement,
        });
    };

    return (
        <button
            type='button'
            className='quoted-reply-post-action'
            aria-label={t('quote_reply_action')}
            title={t('quote_reply_action_title')}
            onClick={handleClick}
        >
            <QuoteIcon/>
            <span className='quoted-reply-post-action__label'>{t('quote_reply_action')}</span>
        </button>
    );
};

export default ReplyButton;
