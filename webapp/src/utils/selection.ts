// Fragment-selection helpers ported from ZILosoft/mattermost-reply
// (Apache License 2.0) and adapted to the Best Reply pending-reply flow.

import {MAX_QUOTED_FRAGMENT_LENGTH} from '../constants';

const POST_ID_PATTERNS = [
    /^post_([a-z0-9]+)$/i,
    /^rhsPost_([a-z0-9]+)$/i,
    /^postView_([a-z0-9]+)$/i,
    /^post-message-([a-z0-9]+)$/i,
    /^([a-z0-9]{26})$/i,
];

// Selectors that identify the rendered body of a message, so the selection
// popup ignores author names, timestamps and other non-message UI text.
const MESSAGE_BODY_SELECTORS = [
    '[data-testid^="postMessageText"]',
    '.post-message__text',
    '.post-message__content',
    '.post__content',
    '.markdown',
];

function matchPostId(value?: string | null): string | null {
    if (!value) {
        return null;
    }

    for (const pattern of POST_ID_PATTERNS) {
        const match = value.match(pattern);
        if (match?.[1]) {
            return match[1];
        }
        if (match?.[0] && match[0].length === 26) {
            return match[0];
        }
    }

    return null;
}

export function extractPostIdFromElement(target: EventTarget | null): string | null {
    if (!(target instanceof Node)) {
        return null;
    }

    let element = target instanceof Element ? target : target.parentElement;
    while (element) {
        const postId = matchPostId(
            element.getAttribute('data-postid') ||
            element.getAttribute('data-post-id') ||
            element.getAttribute('data-testid') ||
            element.id,
        );

        if (postId) {
            return postId;
        }

        element = element.parentElement;
    }

    return null;
}

function findClosestMessageBody(node: Node | null): HTMLElement | null {
    const element = node instanceof Element ? node : node?.parentElement ?? null;
    if (!element) {
        return null;
    }

    return element.closest<HTMLElement>(MESSAGE_BODY_SELECTORS.join(','));
}

export function normalizeQuotedFragment(value: string): string {
    const normalized = value.replace(/\u00a0/g, ' ').trim();
    if (normalized.length <= MAX_QUOTED_FRAGMENT_LENGTH) {
        return normalized;
    }

    return `${normalized.slice(0, MAX_QUOTED_FRAGMENT_LENGTH - 1).trimEnd()}…`;
}

export type SelectionQuoteContext = {
    postId: string;
    selectedText: string;
    messageBody: HTMLElement;
    rect: DOMRect;
};

// A selection is quotable when it starts and ends inside the same message
// body of the same post; selections spanning posts or covering UI text are
// rejected.
export function getSelectionQuoteContext(): SelectionQuoteContext | null {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        return null;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText) {
        return null;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect.width && !rect.height) {
        return null;
    }

    const startPostId = extractPostIdFromElement(range.startContainer);
    const endPostId = extractPostIdFromElement(range.endContainer);
    if (!startPostId || startPostId !== endPostId) {
        return null;
    }

    const startBody = findClosestMessageBody(range.startContainer);
    const endBody = findClosestMessageBody(range.endContainer);
    if (!startBody || startBody !== endBody) {
        return null;
    }

    return {
        postId: startPostId,
        selectedText,
        messageBody: startBody,
        rect,
    };
}
