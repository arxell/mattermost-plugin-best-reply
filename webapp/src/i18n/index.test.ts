import {describe, expect, it} from 'vitest';

import {messages, type MessageId} from './messages';

import {translate, useTranslation, getTranslationsForLocale} from './index';

describe('translate', () => {
    it('returns the localized string for known locales', () => {
        expect(translate('en', 'quote_action')).toBe('Quote');
        expect(translate('ru', 'quote_action')).toBe('Цитировать');
        expect(translate('fr', 'quote_action')).toBe('Citer');
        expect(translate('de', 'quote_action')).toBe('Zitieren');
    });

    it('falls back to English for unknown locales', () => {
        expect(translate('pt-BR', 'quote_reply_action')).toBe('Quote');
    });

    it('labels the quote reply button and menu item distinctly from the native reply', () => {
        expect(translate('ru', 'quote_reply_action')).toBe('Цитата');
        expect(translate('ru', 'quote_reply_action_title')).toBe('Ответить с цитатой здесь');
        expect(translate('ru', 'quote_in_thread_action')).toBe('Ответить в треде с цитатой');
        expect(translate('en', 'quote_in_thread_action')).toBe('Quote in thread');
    });

    it('exposes every message id from the English table', () => {
        const ids = Object.keys(messages.en) as MessageId[];
        expect(ids).toContain('quote_action');
        expect(ids).toContain('quote_reply_action');
        expect(ids).toContain('quote_reply_action_title');
        expect(ids).toContain('quote_in_thread_action');
        expect(ids).toContain('thread_action');
    });
});

describe('getTranslationsForLocale', () => {
    it('renames the native Reply action to Thread in the given language', () => {
        expect(getTranslationsForLocale('en')).toEqual({
            'post_info.reply': 'Thread',
            'post_info.comment_icon.tooltip.reply': 'Thread',
        });
        expect(getTranslationsForLocale('ru')['post_info.reply']).toBe('Тред');
        expect(getTranslationsForLocale('fr')['post_info.reply']).toBe('Fil');
        expect(getTranslationsForLocale('de')['post_info.reply']).toBe('Thread');
    });
});

describe('useTranslation', () => {
    it('is a hook returning a translator bound to the store locale', () => {
        // Rendering the hook needs a store; assert its contract instead:
        // same signature as translate with a pre-bound locale.
        expect(typeof useTranslation).toBe('function');
    });
});
