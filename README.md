# evkom.dev

Retro 2000s-style personal portfolio for Egor Komarov.

## Features

- **Retro Aesthetic**: 2000s-inspired UI with Space Mono, blocky borders, and CSS Grid layout.
- **Custom SSG**: Two-phase rendering pipeline (Static EJS build + Dynamic runtime injection).
- **Guestbook**: Google Sheets integration for persistent entries.
- **Security**: Stateless gating with Cloudflare Turnstile token verification.

## Tech Stack

- **Core**: Node.js, HTML, Vanilla CSS.
- **Backend**: Express (dev server), Google Sheets API.
- **Deployment**: Static build output in `dist/`.

## Setup

### Prerequisites

- Node.js v20+

### Configuration

Create a `.env` file in the root directory:

```bash
TURNSTILE_SITE_KEY=your_site_key
TURNSTILE_SECRET_KEY=your_secret_key
GOOGLE_SERVICE_ACCOUNT='{"type": "service_account", ...}'
GOOGLE_SHEET_ID=your_sheet_id
GOOGLE_SHEET_NAME=Sheet1
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

Output generated in `dist/`.
