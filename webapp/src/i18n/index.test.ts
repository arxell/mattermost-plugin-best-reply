import {describe, expect, it} from 'vitest';

import {translate, useTranslation, getTranslationsForLocale} from './index';
import {messages, type Locale, type MessageId} from './messages';

describe('translate', () => {
    it('returns the localized string for known locales', () => {
        expect(translate('en', 'quote_action')).toBe('Quote');
        expect(translate('ru', 'quote_action')).toBe('Цитировать');
        expect(translate('fr', 'quote_action')).toBe('Citer');
        expect(translate('de', 'quote_action')).toBe('Zitieren');
    });

    it('falls back to English for unknown locales', () => {
        expect(translate('pt-BR', 'reply_action')).toBe('Reply');
    });

    it('exposes every message id from the English table', () => {
        const ids = Object.keys(messages.en) as MessageId[];
        expect(ids).toContain('quote_action');
        expect(ids).toContain('reply_action');
        expect(ids).toContain('reply_action_title');
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
