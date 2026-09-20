import {describe, expect, it} from 'vitest';

import {CLEAR_PENDING_REPLY, SET_PENDING_REPLY} from '../types/store';
import type {PendingReply} from '../types/store';

import reducer from './index';

const pendingReply: PendingReply = {
    replyToPostId: '4w9h6fbja78jueyh1hgcqg8z4y',
    channelId: 'n4uamu6rkiykijzizif8ahdkme',
    rootId: '',
    context: 'channel',
    selectedText: 'фрагмент',
};

describe('pendingReply reducer', () => {
    it('returns the initial state', () => {
        expect(reducer(undefined, {type: '@@INIT'})).toEqual({pendingReply: null});
    });

    it('stores a pending reply', () => {
        expect(reducer(undefined, {type: SET_PENDING_REPLY, data: pendingReply})).toEqual({
            pendingReply,
        });
    });

    it('normalizes falsy data to null', () => {
        const state = reducer(undefined, {type: SET_PENDING_REPLY, data: pendingReply});
        expect(reducer(state, {type: SET_PENDING_REPLY, data: null})).toEqual({pendingReply: null});
        expect(reducer(state, {type: SET_PENDING_REPLY})).toEqual({pendingReply: null});
    });

    it('clears the pending reply', () => {
        const state = reducer(undefined, {type: SET_PENDING_REPLY, data: pendingReply});
        expect(reducer(state, {type: CLEAR_PENDING_REPLY})).toEqual({pendingReply: null});
    });

    it('ignores unknown actions', () => {
        const state = reducer(undefined, {type: SET_PENDING_REPLY, data: pendingReply});
        expect(reducer(state, {type: 'SOMETHING_ELSE'})).toBe(state);
    });
});
