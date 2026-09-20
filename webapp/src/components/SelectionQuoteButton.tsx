// Selection popup and Ctrl+Q hotkey for quoting a fragment of a message.
// Ported from ZILosoft/mattermost-reply (Apache License 2.0) and adapted to
// the Best Reply pending-reply flow.

import React, {useCallback, useEffect, useState} from 'react';
import {useStore} from 'react-redux';

import {ensurePostLoaded} from '../actions/navigateToPost';
import {isReplyablePost} from '../actions/openThread';
import {isReplyInThreadView, startReplyToPost} from '../actions/reply';
import {useTranslation} from '../i18n';
import {getSelectionQuoteContext, type SelectionQuoteContext} from '../utils/selection';

type OverlayState = SelectionQuoteContext & {
    top: number;
    left: number;
};

const POPUP_WIDTH = 96;
const POPUP_OFFSET = 8;

function readSelectionOverlay(): OverlayState | null {
    const context = getSelectionQuoteContext();
    if (!context) {
        return null;
    }

    // The selection rect lives in viewport coordinates, so the popup is
    // positioned with position: fixed and clamped onscreen.
    return {
        ...context,
        top: Math.min(context.rect.bottom + POPUP_OFFSET, window.innerHeight - 52),
        left: Math.min(context.rect.left + (context.rect.width / 2), window.innerWidth - POPUP_WIDTH),
    };
}

const SelectionQuoteButton: React.FC = () => {
    const store = useStore();
    const [overlay, setOverlay] = useState<OverlayState | null>(null);
    const t = useTranslation();

    const submitQuote = useCallback(async (current: OverlayState) => {
        setOverlay(null);
        window.getSelection()?.removeAllRanges();

        const post = await ensurePostLoaded(store, current.postId);
        if (!post || !isReplyablePost(post)) {
            return;
        }

        await startReplyToPost(store, post, {
            context: isReplyInThreadView(current.messageBody) ? 'thread' : 'channel',
            element: current.messageBody,
            selectedText: current.selectedText,
        });
    }, [store]);

    useEffect(() => {
        const updateOverlay = () => setOverlay(readSelectionOverlay());
        const clearOverlay = () => setOverlay(null);

        const handleKeyDown = (event: KeyboardEvent) => {
            if (!event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
                return;
            }

            if (event.key.toLowerCase() !== 'q') {
                return;
            }

            const current = readSelectionOverlay();
            if (!current) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            submitQuote(current);
        };

        document.addEventListener('selectionchange', updateOverlay);
        document.addEventListener('keydown', handleKeyDown, true);
        window.addEventListener('scroll', clearOverlay, true);
        window.addEventListener('resize', updateOverlay);

        return () => {
            document.removeEventListener('selectionchange', updateOverlay);
            document.removeEventListener('keydown', handleKeyDown, true);
            window.removeEventListener('scroll', clearOverlay, true);
            window.removeEventListener('resize', updateOverlay);
        };
    }, [submitQuote]);

    if (!overlay) {
        return null;
    }

    return (
        <button
            type='button'
            className='best-reply-selection-popup'
            style={{top: `${overlay.top}px`, left: `${overlay.left}px`}}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
                submitQuote(overlay);
            }}
        >
            {t('quote_action')}
        </button>
    );
};

export default SelectionQuoteButton;
