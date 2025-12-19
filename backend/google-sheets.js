import { google } from 'googleapis';
import validator from 'validator';

/**
 * Gets an authenticated Google Sheets client.
 */
async function getSheetsClient() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT) {
    console.warn(
      'GOOGLE_SERVICE_ACCOUNT is not set. Google Sheets integration disabled.'
    );
    return null;
  }

  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return google.sheets({ version: 'v4', auth });
  } catch (err) {
    console.error('Failed to initialize Google Sheets client:', err);
    return null;
  }
}

export async function appendGuestbookMessage(name, message) {
  try {
    const sheets = await getSheetsClient();
    if (!sheets) {
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

    await sheets.spreadsheets.values.append({
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
    const sheets = await getSheetsClient();
    if (!sheets) {
      return [];
    }
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = `${process.env.GOOGLE_SHEET_NAME}!A:C`;

    const response = await sheets.spreadsheets.values.get({
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
