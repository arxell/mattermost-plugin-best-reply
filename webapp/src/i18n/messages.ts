// UI strings for the plugin itself. The dictionaries are the single source
// of truth: MessageId is derived from the English table, so every call site
// is compile-checked and the symmetry test (i18n/messages.test.ts) keeps the
// locales in lockstep.

export const messages = {
    en: {
        quote_action: 'Quote',
        quote_reply_action: 'Quote',
        quote_reply_action_title: 'Reply with a quote here',
        quote_in_thread_action: 'Quote in thread',
        thread_action: 'Thread',
    },
    ru: {
        quote_action: 'Цитировать',
        quote_reply_action: 'Цитата',
        quote_reply_action_title: 'Ответить с цитатой здесь',
        quote_in_thread_action: 'Ответить в треде с цитатой',
        thread_action: 'Тред',
    },
    fr: {
        quote_action: 'Citer',
        quote_reply_action: 'Citation',
        quote_reply_action_title: 'Répondre avec une citation ici',
        quote_in_thread_action: 'Citer dans le fil',
        thread_action: 'Fil',
    },
    de: {
        quote_action: 'Zitieren',
        quote_reply_action: 'Zitat',
        quote_reply_action_title: 'Hier mit Zitat antworten',
        quote_in_thread_action: 'Im Thread zitieren',
        thread_action: 'Thread',
    },
} as const;

export type Locale = keyof typeof messages;

export type MessageId = keyof typeof messages.en;
