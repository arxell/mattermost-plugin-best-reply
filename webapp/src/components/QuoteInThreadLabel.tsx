import React from 'react';

import {useTranslation} from '../i18n';

// Post menu item label; rendered by Mattermost inside its store provider, so
// it follows the user's language like the rest of the plugin UI.
const QuoteInThreadLabel: React.FC = () => {
    const t = useTranslation();

    return <>{t('quote_in_thread_action')}</>;
};

export default QuoteInThreadLabel;
