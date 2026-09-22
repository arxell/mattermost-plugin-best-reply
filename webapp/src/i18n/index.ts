import {useSelector} from 'react-redux';

import {messages, type Locale, type MessageId} from './messages';

import {getCurrentUserLocale} from '../utils/posts';

// Fallback chain: unknown locale -> en -> the key itself.
export function translate(locale: string, id: MessageId): string {
    const table = messages[locale as Locale] ?? messages.en;
    return table[id] ?? messages.en[id] ?? id;
}

// Resolves the user's Mattermost locale from the store so components
// re-render live when the language changes.
export function useTranslation(): (id: MessageId) => string {
    const locale = useSelector(getCurrentUserLocale);
    return (id: MessageId) => translate(locale, id);
}

// Strings handed to the Mattermost registry on startup are resolved once, at
// registration time, and cannot react to locale changes afterwards. They are
// used only to rename the *native* Reply action to "Thread".
const THREAD_TRANSLATION_KEYS = [
    'post_info.reply',
    'post_info.comment_icon.tooltip.reply',
] as const;

export function getTranslationsForLocale(locale: string): Record<string, string> {
    const threadLabel = translate(locale, 'thread_action');

    return THREAD_TRANSLATION_KEYS.reduce<Record<string, string>>((translations, key) => {
        translations[key] = threadLabel;
        return translations;
    }, {});
}
