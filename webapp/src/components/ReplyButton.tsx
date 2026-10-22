import React, {useCallback, useState} from 'react';
import {useStore} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {isReplyablePost} from '../actions/openThread';
import {isReplyInThreadView, startReplyToPost} from '../actions/reply';
import {useTranslation} from '../i18n';
import type {ReplyContext} from '../types/store';

type Props = {
    post: Post;
};

const ReplyIcon = ({separate = false}: {separate?: boolean}) => (
    <svg
        width='18'
        height='18'
        viewBox='0 0 24 24'
        fill='none'
        aria-hidden='true'
    >
        <path
            d={separate ? 'M7 20V8m0 8L19 4m-7 0h7v7' : 'M10 5 4 11l6 6M4 11h9a7 7 0 0 1 7 7'}
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
        />
    </svg>
);

const ReplyButton: React.FC<Props> = ({post}) => {
    const store = useStore();
    const t = useTranslation();
    const [isThreadView, setIsThreadView] = useState(true);
    const setActionElement = useCallback((element: HTMLSpanElement | null) => {
        if (element) {
            setIsThreadView(isReplyInThreadView(element));
        }
    }, []);

    if (!isReplyablePost(post)) {
        return null;
    }

    const showBothActions = !post.root_id && !isThreadView;
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>, context: ReplyContext) => {
        event.preventDefault();
        event.stopPropagation();

        startReplyToPost(store, post, {
            context,
            element: event.currentTarget,
        });
    };

    return (
        <span
            ref={setActionElement}
            className='quoted-reply-post-actions'
        >
            {showBothActions && (
                <button
                    type='button'
                    className='quoted-reply-post-action quoted-reply-post-action--icon'
                    aria-label={t('reply_separate_action')}
                    title={t('reply_separate_action')}
                    onClick={(event) => handleClick(event, 'channel')}
                >
                    <ReplyIcon separate={true}/>
                </button>
            )}
            <button
                type='button'
                className={`quoted-reply-post-action${showBothActions ? ' quoted-reply-post-action--icon' : ''}`}
                aria-label={t(showBothActions ? 'reply_in_thread_action' : 'reply_action')}
                title={t(showBothActions ? 'reply_in_thread_action' : 'reply_action_title')}
                onClick={(event) => handleClick(event, 'thread')}
            >
                <ReplyIcon/>
                {!showBothActions && <span className='quoted-reply-post-action__label'>{t('reply_action')}</span>}
            </button>
        </span>
    );
};

export default ReplyButton;
