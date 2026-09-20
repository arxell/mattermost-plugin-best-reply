import {describe, expect, it} from 'vitest';

import {messages, type Locale, type MessageId} from './messages';

const englishIds = Object.keys(messages.en) as MessageId[];
const locales = Object.keys(messages) as Locale[];

describe('message dictionary symmetry', () => {
    it('every locale defines exactly the same keys as English', () => {
        for (const locale of locales) {
            if (locale === 'en') {
                continue;
            }
            const ids = Object.keys(messages[locale]);
            expect(ids.sort(), `locale ${locale}`).toEqual([...englishIds].sort());
        }
    });

    it('all values are non-empty strings', () => {
        for (const locale of locales) {
            for (const id of englishIds) {
                const value = messages[locale][id];
                expect(typeof value, `${locale}.${id}`).toBe('string');
                expect(value.trim(), `${locale}.${id}`).not.toBe('');
            }
        }
    });

    it('keeps English and at least one non-English locale', () => {
        expect(locales).toContain('en');
        expect(locales.length).toBeGreaterThan(1);
    });
});
