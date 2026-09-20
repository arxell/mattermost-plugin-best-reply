import {describe, expect, it} from 'vitest';

import {getQuoteLabel, getReplyActionLabel, getReplyActionTitle, getTranslationsForLocale} from './index';

describe('i18n labels', () => {
    it('translates to Russian for ru locales', () => {
        expect(getQuoteLabel('ru')).toBe('Цитировать');
        expect(getQuoteLabel('ru-RU')).toBe('Цитировать');
        expect(getReplyActionLabel('ru')).toBe('Ответить');
        expect(getReplyActionTitle('ru')).toBe('Ответить на сообщение');
    });

    it('falls back to English', () => {
        expect(getQuoteLabel('en')).toBe('Quote');
        expect(getQuoteLabel('de')).toBe('Quote');
        expect(getReplyActionLabel('en')).toBe('Reply');
        expect(getReplyActionTitle('fr')).toBe('Reply to message');
    });
});

describe('getTranslationsForLocale', () => {
    it('renames the native Reply action to Thread', () => {
        const en = getTranslationsForLocale('en');
        expect(en['post_info.reply']).toBe('Thread');
        expect(en['post_info.comment_icon.tooltip.reply']).toBe('Thread');

        const ru = getTranslationsForLocale('ru');
        expect(ru['post_info.reply']).toBe('Тред');
    });
});
