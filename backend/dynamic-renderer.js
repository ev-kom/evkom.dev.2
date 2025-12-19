import ejs from 'ejs';
import { getError500 } from './static-renderer.js';

import { guestbook_messages } from '../pages/guestbook/guestbook.server.js';

const PAGE_HANDLERS = {
  guestbook: {
    guestbook_messages,
  },
};

/**
 * Processes an HTML string acting as a runtime EJS template.
 * Includes a `dynamic(key)` helper for rendering sub-components:
 * <%- dynamic('componentName') %>
 *
 * @param {string} html - HTML string containing runtime EJS tags
 * @param {object} params - Runtime params (e.g. { captchaToken, pageName })
 * @returns {Promise<string>} HTML with dynamic content rendered
 */
export async function processDynamicContent(html, params = {}) {
  const pageHandlers = PAGE_HANDLERS[params.pageName];

  if (!pageHandlers) {
    return html;
  }

  const dynamicContent = {};

  try {
    const handlerPromises = Object.entries(pageHandlers).map(
      async ([key, handler]) => {
        try {
          dynamicContent[key] = await handler();
        } catch (err) {
          console.error(`Error rendering dynamic component '${key}':`, err);
          dynamicContent[key] = '';
        }
      }
    );

    await Promise.all(handlerPromises);

    params.dynamic = (key) => {
      if (dynamicContent[key]) {
        return dynamicContent[key];
      }
      console.warn(
        `Dynamic module/function '${key}' not found for page '${params.pageName}'.`
      );
      return '';
    };

    return ejs.render(html, params);
  } catch (e) {
    console.error('Error processing dynamic content:', e);
    return await getError500();
  }
}
