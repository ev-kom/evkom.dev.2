# evkom.dev

Retro 2000s-style personal portfolio for Egor Komarov.

## Features

- **Vanilla JS**: Built without frameworks to keep the site lightweight. External libraries are restricted to only those providing significant value.
- **Retro Aesthetic**: 2000s-inspired UI with Space Mono, blocky borders, and CSS Grid layout.
- **Custom SSG & Server**: A bespoke build system and dev server written in pure Node.js, Express, and EJS. Features a two-phase rendering pipeline (Static Build + Dynamic Runtime). Because sometimes reinventing the wheel is just plain fun.
- **Guestbook**: Google Sheets integration for persistent entries.
- **Y2K Error Pages**: Themed 404 and 500 pages with interactive elements.
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
