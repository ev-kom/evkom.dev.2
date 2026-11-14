import {
  CaptchaState,
  verifyTurnstileToken,
  generateSessionToken,
  renewSessionToken,
} from '../../backend/captcha.js';
import { getGuestbookMessages } from '../../backend/google-sheets.js';

/**
 * Dynamic Handler for Guestbook Page
 */
export const guestbook_content = async ({ render, ...params }) => {
  try {
    // 1. Allow access via valid Session Token (from POST body during reload)
    // Renewal keeps the original session start, so it never outlives the 30-minute cap.
    const renewedToken = await renewSessionToken(params.sessionToken);
    if (renewedToken) {
      return await render('guestbook/content', {
        sessionToken: renewedToken,
      });
    }

    // 2. Verify Turnstile (Gate Entry)
    const token = params['cf-turnstile-response'];
    const verificationStatus = await verifyTurnstileToken(token);

    if (verificationStatus === CaptchaState.EMPTY) {
      return await render('guestbook/gate');
    }

    if (verificationStatus === CaptchaState.INVALID) {
      return await render('guestbook/error');
    }

    // This template contains <x-dynamic src="guestbook/messages">
    const sessionToken = await generateSessionToken();

    if (!sessionToken) {
      console.error('Failed to generate session token (missing secret?)');
      return await render('guestbook/error');
    }

    return await render('guestbook/content', { sessionToken });
  } catch (err) {
    console.error('Error rendering guestbook content:', err);
    return await render('guestbook/error');
  }
};

/**
 * Handler for the list of messages
 */
export const guestbook_messages = async ({ render }) => {
  try {
    const messages = await getGuestbookMessages();

    if (messages.length > 0) {
      const messagesHtml = await Promise.all(
        messages.map((msg) =>
          render('guestbook/message', {
            name: msg.name,
            timestamp: msg.timestamp,
            message: msg.message,
          })
        )
      );
      return messagesHtml.join('');
    }

    return await render('guestbook/no_messages');
  } catch (err) {
    console.error('Error rendering guestbook messages:', err);
    return await render('guestbook/error');
  }
};
