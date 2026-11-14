/** True when the server runs with `--dev`. Shared by server.js and backend/captcha.js. */
export const IS_DEV = process.argv.includes('--dev');
