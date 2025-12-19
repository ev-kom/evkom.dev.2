import ejs from 'ejs';
import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getGuestbookMessages } from '../../backend/google-sheets.js';
import { getError500 } from '../../backend/static-renderer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function loadTemplate(filename) {
  return readFile(join(__dirname, filename), 'utf8');
}

export const guestbook_messages = async (params) => {
  try {
    const messages = await getGuestbookMessages();

    if (!Array.isArray(messages)) {
      return '<div class="loading-text">Error loading messages.</div>';
    }

    if (!messages || messages.length === 0) {
      return '<div class="loading-text">No messages yet.</div>';
    }

    const template = await loadTemplate('message.html');

    return messages
      .map((message) => ejs.render(template, { ...message }))
      .join('');
  } catch (err) {
    console.error('Error rendering guestbook messages:', err);
    return getError500();
  }
};
