// client/src/sprint3-forum/ForumPage.jsx
import { useId, useState } from 'react';
import { useParams } from 'react-router';
import ChannelSwitcher from './ChannelSwitcher.jsx';
import MessageForm from './MessageForm.jsx';
import MessageList from './MessageList.jsx';
import { useForumMessages } from './useForumMessages.js';
import styles from './ForumPage.module.css';

export default function ForumPage() {
  const headingId = useId();
  const { channelId } = useParams();
  const [refreshKey, setRefreshKey] = useState(0);

  const { status, messages, error } = useForumMessages(channelId, refreshKey);

  return (
    <section className={styles.page} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.title}>
        Forum channels
      </h2>
      <ChannelSwitcher />
      <MessageList
        status={status}
        messages={messages}
        error={error}
        onRetry={() => setRefreshKey((key) => key + 1)}
      />
      <MessageForm forum={channelId} onPosted={() => setRefreshKey((key) => key + 1)} />
    </section>
  );
}
