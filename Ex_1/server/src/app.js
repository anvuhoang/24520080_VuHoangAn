// server/src/app.js
import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express from 'express';
import { pickMessageFields, validateMessage } from '../../client/src/sprint3-forum/messageRules.js';
import { createMemoryStore } from './store.js';

export const DEFAULT_CLIENT_ORIGIN = 'http://localhost:5173';

export function createApp({ store = createMemoryStore(), clientOrigin = process.env.CLIENT_ORIGIN ?? DEFAULT_CLIENT_ORIGIN } = {}) {
  const app = express();
  app.disable('x-powered-by');

  // An explicit origin, never '*'
  app.use(cors({ origin: clientOrigin }));
  app.use(express.json({ limit: '10kb' }));

  app.get('/api/messages/:forum', async (request, response) => {
    const messages = await store.getMessages(request.params.forum);
    if (!messages) {
      response.status(404).json({ error: `Unknown forum: ${request.params.forum}` });
      return;
    }
    response.json(messages);
  });

  app.post('/api/messages/:forum', async (request, response) => {
    const { forum } = request.params;
    if (!(await store.hasForum(forum))) {
      response.status(404).json({ error: `Unknown forum: ${forum}` });
      return;
    }

    const details = validateMessage(request.body);
    if (Object.keys(details).length > 0) {
      const missing = details.author === 'Author is required.' || details.text === 'Message text is required.';
      response.status(400).json({ error: missing ? 'Missing required fields' : 'Invalid message', details });
      return;
    }

    // Only the two known fields are taken from the body: the client can never choose the id or the time
    const message = {
      id: randomUUID(),
      ...pickMessageFields(request.body),
      timestamp: new Date().toISOString(),
    };
    await store.addMessage(forum, message);
    response.status(201).json(message);
  });

  app.use('/api', (request, response) => {
    response.status(404).json({ error: 'Not found' });
  });

  // One error handler: bad JSON and big bodies get their own answers, everything else is a plain 500
  // eslint-disable-next-line no-unused-vars
  app.use((error, request, response, next) => {
    if (error?.type === 'entity.parse.failed') {
      response.status(400).json({ error: 'Invalid JSON body' });
      return;
    }
    if (error?.type === 'entity.too.large') {
      response.status(413).json({ error: 'Payload too large' });
      return;
    }
    response.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
