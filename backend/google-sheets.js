import { auth as googleAuth, sheets } from '@googleapis/sheets';
import validator from 'validator';

let sheetsClient = null;

/**
 * Gets the Google Sheets client. Built once on first use and cached; a failed
 * or skipped init is not cached, so it is retried on the next call.
 */
function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  if (!process.env.GOOGLE_SERVICE_ACCOUNT) {
    console.warn(
      'GOOGLE_SERVICE_ACCOUNT is not set. Google Sheets integration disabled.'
    );
    return null;
  }

  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    // JWT directly: GoogleAuth({ credentials }) is deprecated in google-auth-library 11.
    const auth = new googleAuth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    sheetsClient = sheets({ version: 'v4', auth });
    return sheetsClient;
  } catch (err) {
    console.error('Failed to initialize Google Sheets client:', err);
    return null;
  }
}

export async function appendGuestbookMessage(name, message) {
  try {
    const client = getSheetsClient();
    if (!client) {
      throw new Error('Google Sheets client not initialized');
    }
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${process.env.GOOGLE_SHEET_NAME}!A:C`;

    // Sanitize and wrap in quotes for storage safety
    const safeName = `"${validator.trim(validator.escape(String(name || '')))}"`;
    const safeMessage = `"${validator.trim(
      validator.escape(String(message || ''))
    )}"`;

    const timestamp = new Date()
      .toLocaleString('sv-SE', { timeZoneName: 'short' })
      .replace(/-/g, '/');

    await client.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[timestamp, safeName, safeMessage]],
      },
    });
  } catch (err) {
    console.error('Google Sheets API Error (Append):', err);
    throw err;
  }
}

export async function getGuestbookMessages() {
  try {
    const client = getSheetsClient();
    if (!client) {
      return [];
    }
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${process.env.GOOGLE_SHEET_NAME}!A:C`;

    const response = await client.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    // Map rows and filter out empty or header-like rows
    const data = rows
      .map((row) => {
        let name = (row[1] || '').toString();
        let message = (row[2] || '').toString();

        // Safe unquote: Only slice if it starts AND ends with quotes
        if (name.startsWith('"') && name.endsWith('"')) {
          name = name.slice(1, -1);
        }
        if (message.startsWith('"') && message.endsWith('"')) {
          message = message.slice(1, -1);
        }

        return {
          timestamp: row[0],
          // Unescape on read so the frontend gets the raw text (which ejs will then safely escape)
          name: validator.unescape(name),
          message: validator.unescape(message),
        };
      })
      .filter((msg) => msg.timestamp && (msg.name || msg.message));

    // Sorting by timestamp descending (newest first)
    data.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return data;
  } catch (err) {
    console.error('Google Sheets API Error (Fetch):', err);
    throw err;
  }
}
