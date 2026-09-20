import React from 'react';

type Props = {
    children: React.ReactNode;
};

type State = {
    error: Error | null;
};

// Keeps a plugin render error from unmounting the whole Mattermost webapp:
// a failed quoted-reply block degrades to the raw message text instead of
// taking the channel down with it.
// An error boundary must always re-render so it can catch; optimizing it
// away would break error recovery.
// eslint-disable-next-line react/require-optimization
export default class ErrorBoundary extends React.Component<Props, State> {
    public state: State = {error: null};

    public static getDerivedStateFromError(error: Error): State {
        return {error};
    }

    public componentDidCatch(error: Error): void {
        // eslint-disable-next-line no-console
        console.error('best-reply: component crashed', error);
    }

    public render(): React.ReactNode {
        if (this.state.error) {
            return null;
        }

        return this.props.children;
    }
}
