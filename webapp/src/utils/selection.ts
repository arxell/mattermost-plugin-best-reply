// Fragment-selection helpers ported from ZILosoft/mattermost-reply
// (Apache License 2.0) and adapted to the Best Reply pending-reply flow.

import {MAX_QUOTED_FRAGMENT_LENGTH} from '../constants';

const POST_ID_PATTERNS = [
    /^post_([a-z0-9]{26})$/i,
    /^rhsPost_([a-z0-9]{26})$/i,
    /^searchResult_([a-z0-9]{26})$/i,
    /^postView_([a-z0-9]{26})$/i,
    /^rhsPostView_([a-z0-9]{26})$/i,
    /^post-message-([a-z0-9]+)$/i,
    /^([a-z0-9]{26})$/i,
];

// Selectors that identify the rendered body of a message, so the selection
// popup ignores author names, timestamps and other non-message UI text.
const MESSAGE_BODY_SELECTORS = [
    '[data-testid="post-message-text"]',
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
        if (match?.[1] && isPostIdLike(match[1])) {
            return match[1];
        }
        if (match?.[0] && isPostIdLike(match[0])) {
            return match[0];
        }
    }

    return null;
}

// Mattermost post ids are 26 lowercase alphanumeric characters. Captures that
// do not look like a post id (e.g. the literal "text" from
// data-testid="post-message-text") must be rejected.
function isPostIdLike(value: string): boolean {
    return (/^[a-z0-9]{26}$/i).test(value);
}

export function extractPostIdFromElement(target: EventTarget | null): string | null {
    if (!(target instanceof Node)) {
        return null;
    }

    let element = target instanceof Element ? target : target.parentElement;
    while (element) {
        // Every attribute is matched on its own: in Mattermost 11.x the post
        // container has both data-testid="postView" (no id inside) and
        // id="post_<id>", so a non-null data-testid must not shadow the id.
        for (const attribute of ['data-postid', 'data-post-id', 'data-testid', 'id']) {
            const postId = matchPostId(element.getAttribute(attribute));
            if (postId) {
                return postId;
            }
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
