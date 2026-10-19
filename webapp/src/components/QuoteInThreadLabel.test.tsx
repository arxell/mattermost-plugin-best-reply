// @vitest-environment jsdom
import React from 'react';
import {createRoot} from 'react-dom/client';
import {act} from 'react-dom/test-utils';
import {Provider} from 'react-redux';
import {createStore} from 'redux';
import {afterEach, describe, expect, it, vi} from 'vitest';

import QuoteInThreadLabel from './QuoteInThreadLabel';

function makeStore(locale: string) {
    return createStore(() => ({
        entities: {
            general: {config: {DefaultClientLocale: 'en'}},
            users: {currentUserId: 'me', profiles: {me: {id: 'me', locale}}},
        },
    }));
}

afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
});

describe('QuoteInThreadLabel', () => {
    it.each([
        {locale: 'ru', label: 'Ответить в треде с цитатой'},
        {locale: 'en', label: 'Quote in thread'},
        {locale: 'pt-BR', label: 'Quote in thread'},
    ])('renders the $locale menu label', ({locale, label}) => {
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);

        act(() => {
            root.render(
                <Provider store={makeStore(locale)}>
                    <QuoteInThreadLabel/>
                </Provider>,
            );
        });

        expect(container.textContent).toBe(label);
        act(() => root.unmount());
    });
});
