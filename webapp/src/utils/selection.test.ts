// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {extractPostIdFromElement, getSelectionQuoteContext, normalizeQuotedFragment} from './selection';

const POST_ID = '4w9h6fbja78jueyh1hgcqg8z4y';
const OTHER_POST_ID = 'x716abf4xiyg8frx5ff1bsk43w';

// DOM fixture modeled after the Mattermost 11.x webapp PostView markup:
// the post container carries id="post_<id>" (or rhsPost_/searchResult_) and
// data-testid="postView"; the message body is .post-message__text with
// data-testid="post-message-text" (lowercase, no post id in it).
function renderPost(id: string, text: string, containerId: string): HTMLElement {
    const container = document.createElement('div');
    container.innerHTML = `
        <div class="a11y__section post" id="${containerId}" data-testid="postView">
            <div class="post__header"><span class="post__time">9:16 PM</span></div>
            <div class="post__content" data-testid="postContent">
                <div class="post-message__text" data-testid="post-message-text" dir="auto">
                    <p>${text}</p>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(container);
    return container;
}

function selectTextRange(root: HTMLElement, startOffset: number, endOffset: number): Range {
    const paragraph = root.querySelector('p')!;
    const textNode = paragraph.firstChild!;
    const range = document.createRange();
    range.setStart(textNode, startOffset);
    range.setEnd(textNode, endOffset);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    // jsdom reports zero rects; pretend the range has a visible box.
    range.getBoundingClientRect = () =>
        ({width: 200, height: 18, top: 100, bottom: 118, left: 40, right: 240} as DOMRect);

    return range;
}

describe('extractPostIdFromElement', () => {
    it('extracts the post id from the Mattermost 11.x post container id', () => {
        const post = renderPost(POST_ID, 'hello world', `post_${POST_ID}`);
        const body = post.querySelector('.post-message__text')!;
        expect(extractPostIdFromElement(body.firstChild)).toBe(POST_ID);
    });

    it('extracts the post id from rhsPost_ containers', () => {
        const post = renderPost(POST_ID, 'hello rhs', `rhsPost_${POST_ID}`);
        const body = post.querySelector('.post-message__text')!;
        expect(extractPostIdFromElement(body.firstChild)).toBe(POST_ID);
    });

    it('extracts the post id from searchResult_ containers', () => {
        const post = renderPost(POST_ID, 'hello search', `searchResult_${POST_ID}`);
        const body = post.querySelector('.post-message__text')!;
        expect(extractPostIdFromElement(body.firstChild)).toBe(POST_ID);
    });

    it('does not treat data-testid="post-message-text" as a post id', () => {
        const post = renderPost(POST_ID, 'hello', `post_${POST_ID}`);
        const body = post.querySelector('.post-message__text')!;

        // The element itself carries data-testid="post-message-text"; walking
        // must not stop there with "text" as the id.
        expect(extractPostIdFromElement(body)).toBe(POST_ID);
    });
});

describe('getSelectionQuoteContext', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    afterEach(() => {
        window.getSelection()?.removeAllRanges();
    });

    it('returns a quotable context for a selection inside one message body', () => {
        const post = renderPost(POST_ID, 'Отвечаю только на фрагмент про поиск.', `post_${POST_ID}`);
        selectTextRange(post, 8, 30);

        const context = getSelectionQuoteContext();
        expect(context).not.toBeNull();
        expect(context!.postId).toBe(POST_ID);
        expect(context!.selectedText).toContain('только на фрагмент');
        expect(context!.messageBody.classList.contains('post-message__text')).toBe(true);
    });

    it('rejects selections spanning two different posts', () => {
        const first = renderPost(POST_ID, 'первое сообщение', `post_${POST_ID}`);
        const second = renderPost(OTHER_POST_ID, 'второе сообщение', `post_${OTHER_POST_ID}`);

        const firstText = first.querySelector('p')!.firstChild!;
        const secondText = second.querySelector('p')!.firstChild!;
        const range = document.createRange();
        range.setStart(firstText, 0);
        range.setEnd(secondText, 3);
        range.getBoundingClientRect = () =>
            ({width: 300, height: 40, top: 0, bottom: 40, left: 0, right: 300} as DOMRect);
        const selection = window.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);

        expect(getSelectionQuoteContext()).toBeNull();
    });

    it('returns null when nothing is selected', () => {
        renderPost(POST_ID, 'hello', `post_${POST_ID}`);
        window.getSelection()?.removeAllRanges();
        expect(getSelectionQuoteContext()).toBeNull();
    });
});

describe('normalizeQuotedFragment', () => {
    it('trims whitespace and non-breaking spaces', () => {
        expect(normalizeQuotedFragment('  hello\u00a0world  ')).toBe('hello world');
    });

    it('truncates fragments longer than the cap with an ellipsis', () => {
        const long = 'a'.repeat(600);
        const normalized = normalizeQuotedFragment(long);
        expect(normalized.length).toBe(500);
        expect(normalized.endsWith('…')).toBe(true);
    });
});
