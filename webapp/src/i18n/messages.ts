// UI strings for the plugin itself. The dictionaries are the single source
// of truth: MessageId is derived from the English table, so every call site
// is compile-checked and the symmetry test (i18n/messages.test.ts) keeps the
// locales in lockstep.

export const messages = {
    en: {
        quote_action: 'Quote',
        reply_action: 'Reply',
        reply_action_title: 'Reply to message',
        reply_separate_action: 'Reply as a separate message',
        reply_in_thread_action: 'Reply in this thread',
        thread_action: 'Thread',
    },
    ru: {
        quote_action: 'Цитировать',
        reply_action: 'Ответить',
        reply_action_title: 'Ответить на сообщение',
        reply_separate_action: 'Ответить отдельным сообщением',
        reply_in_thread_action: 'Ответить в этом треде',
        thread_action: 'Тред',
    },
    fr: {
        quote_action: 'Citer',
        reply_action: 'Répondre',
        reply_action_title: 'Répondre au message',
        reply_separate_action: 'Répondre dans un message séparé',
        reply_in_thread_action: 'Répondre dans ce fil',
        thread_action: 'Fil',
    },
    de: {
        quote_action: 'Zitieren',
        reply_action: 'Antworten',
        reply_action_title: 'Auf Nachricht antworten',
        reply_separate_action: 'Als separate Nachricht antworten',
        reply_in_thread_action: 'In diesem Thread antworten',
        thread_action: 'Thread',
    },
} as const;

export type Locale = keyof typeof messages;

export type MessageId = keyof typeof messages.en;
