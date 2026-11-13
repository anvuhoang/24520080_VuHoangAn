// src/forum/useForumMessages.js
import { useEffect, useState } from 'react';
import { fetchMessages } from './forumApi.js';

export function useForumMessages(forum, refreshKey = 0) {
  const [state, setState] = useState({ forum, status: 'loading', messages: [], error: null });

  useEffect(() => {
    const controller = new AbortController();

    // Another forum starts from nothing; a refresh of the same forum keeps what is already shown
    setState((previous) =>
      previous.forum === forum
        ? { ...previous, status: 'loading', error: null }
        : { forum, status: 'loading', messages: [], error: null }
    );

    fetchMessages(forum, { signal: controller.signal }).then(
      (messages) => {
        if (controller.signal.aborted) return;
        setState({ forum, status: 'success', messages, error: null });
      },
      (error) => {
        // Only OUR abort is ignored (the answer of an old request must never change the state);
        // an AbortError that came from somewhere else is a failure and must not leave "loading" for ever
        if (controller.signal.aborted) return;
        setState({ forum, status: 'error', messages: [], error: error?.message ?? 'Request failed' });
      }
    );

    return () => controller.abort();
  }, [forum, refreshKey]);

  // Data that belongs to another forum is never shown, not even for one render
  if (state.forum !== forum) {
    return { status: 'loading', messages: [], error: null };
  }
  return { status: state.status, messages: state.messages, error: state.error };
}
