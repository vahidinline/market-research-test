# Market Research Dashboard

An open-source React dashboard for deep competitive market research. The application combines Instagram profile data, AI-assisted analysis, competitor benchmarking, SWOT strategy, CPM scoring, and interactive positioning maps in a Persian-first, RTL interface.

> Current release: `0.0.2`

## Overview

Market Research Dashboard is designed for founders, marketing teams, brand strategists, and researchers who need more than a short AI summary. It organizes a full research workflow into a tabbed decision-support interface:

- Industry overview and market categories
- Competitor directory with websites, locations, handles, and active channels
- Deep competitor profiles
- Instagram and website audits
- SWOT strategy matrix
- Detailed Competitive Profile Matrix (CPM)
- Interactive Recharts positioning maps
- Prioritized strategic recommendations

The UI is currently optimized for Persian content and right-to-left layouts, while the codebase and documentation are in English.

## Features

### Multi-tab research workspace

The report is divided into seven focused views instead of one long page:

1. Industry Overview & Market Categories
2. Competitor Overview & List
3. Detailed Competitor Analysis
4. SWOT Matrix
5. Detailed CPM Matrix
6. Positioning Maps
7. Strategic Recommendations

### Deep competitor analysis

Each competitor can include:

- Business bio, location, website, and active platforms
- Instagram, LinkedIn, TikTok, and Pinterest business links
- Product and service categories
- Marketing activities and campaign observations
- Instagram publishing dates, follower count, post count, and engagement rate
- Media-format distribution for photos, videos, and carousels
- Visual identity, bio, caption, hashtag, and storytelling analysis
- Best content idea with a source link
- Website UX, mobile, SEO, booking, and live-support analysis

### Detailed CPM scoring

The CPM view supports factor-level and sub-criteria scoring across:

- Instagram: visual quality, creativity, scripts, captions, storytelling, bio, highlights, layout, and engagement
- Website: UX, device compatibility, SEO, service categorization, online booking, and live support
- Trust: physical store, digital presence, influencer collaborations, and experience
- Product and services: diversity, customization, accessories, and additional services

### Interactive positioning maps

Four Recharts scatter maps compare:

- Instagram score vs. website score
- Credibility score vs. product/service score
- Website score vs. credibility score
- Instagram score vs. credibility score

## Tech stack

- React 19
- Vite
- Tailwind CSS 4
- Recharts
- Lucide React
- Gemini or OpenRouter for AI analysis
- Apify for Instagram profile collection
- pnpm for package management

## Getting started

### Requirements

- Node.js 20 or newer
- pnpm 9 or newer
- An Apify API token for live Instagram data
- A Gemini API key or OpenRouter API key for AI analysis

### Installation

```bash
git clone https://github.com/your-username/market-research-dashboard.git
cd market-research-dashboard
pnpm install
```

### Environment configuration

Create a local environment file:

```bash
cp .env.example .env.local
```

Example configuration:

```env
VITE_APIFY_API_KEY=your_apify_token
VITE_GEMINI_MODEL=gemini-3.5-flash-lite

# Optional Apify Actor IDs for additional public platforms
VITE_APIFY_TIKTOK_ACTOR=
VITE_APIFY_YOUTUBE_ACTOR=
VITE_APIFY_LINKEDIN_ACTOR=
VITE_APIFY_PINTEREST_ACTOR=

# Demo/client-side gate only — not production authentication
VITE_AUTH_EMAIL=your-email@example.com
VITE_AUTH_PASSWORD=change-this-password
```

Never commit `.env.local` or real credentials to a public repository.

For the optional OpenAI-compatible 9Router provider, keep credentials in the
Cloudflare Pages Function environment (not in a `VITE_*` variable):

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.5-flash-lite
NINE_ROUTER_API_KEY=your_9router_api_key
NINE_ROUTER_BASE_URL=https://router.example.com/v1
```

For local Pages development, place these values in the git-ignored `.dev.vars`
file. In production, add `NINE_ROUTER_API_KEY` as an encrypted Pages secret.

### Run locally

```bash
pnpm dev
```

Open `http://localhost:5173`. This command builds the frontend and starts the
Cloudflare worker routes used by Gemini, 9Router, Apify, projects, and website
inspection. Use `pnpm dev:frontend` only for frontend-only work that does not
call these API routes. `pnpm dev:fullstack` remains an alias for `pnpm dev`.

### Production build

```bash
pnpm build
pnpm preview
```

`pnpm preview` also starts the Cloudflare Worker on port 4173, because a static
Vite preview cannot serve `/api/ai` or the other server-side routes.

### Lint

```bash
pnpm lint
```

## AI providers

The application supports two analysis providers:

- Google Gemini, proxied through `/api/ai` and configured with the server-side `GEMINI_API_KEY` secret and `VITE_GEMINI_MODEL`
- OpenRouter, supported by the shared AI utility and provider configuration

The prompt requests a structured JSON response containing the complete research schema. The response parser also handles fenced JSON, surrounding text, and common trailing-comma errors. If an AI response fails, the app retries the AI request using the already-fetched data rather than making another Apify request.

## Data collection and cost awareness

Live Instagram profile collection is performed through Apify. Scraped profiles are cached in memory for the current browser session, so retrying an AI response does not trigger another Apify run.

Users are responsible for:

- Following Instagram, Apify, and platform terms of service
- Respecting privacy, rate limits, and applicable laws
- Reviewing generated analysis before making business decisions
- Monitoring API usage and costs

The demo report can be opened without external API calls through the sample-data action.

## Authentication note

The current authentication gate is a lightweight client-side demo gate. Credentials are read from `VITE_AUTH_EMAIL` and `VITE_AUTH_PASSWORD`, which means they are bundled into the frontend and are not secret in a deployed browser application.

For production use, replace `AuthGate` with a server-backed authentication system such as:

- Auth.js
- Supabase Auth
- Clerk
- Firebase Authentication
- A custom backend session flow

Do not use the current client-side credentials as security protection for sensitive data.

## Project structure

```text
src/
├── App.jsx                    Application state and report workflow
├── index.css                  Global dashboard and responsive styles
├── components/
│   ├── AuthGate.jsx            Client-side demo login gate
│   ├── ConfigForm.jsx          Research configuration form
│   ├── LoadingScreen.jsx       Progress and error state
│   └── Report.jsx              Tabbed dashboard and visualizations
└── utils/
    ├── ai.js                   Prompt building and AI provider calls
    ├── apify.js                Instagram collection and normalization
    └── mockData.js              Offline/demo report data
```

## JSON output contract

The AI response is expected to include these top-level fields:

```text
industryOverview
marketCategories
competitorList
competitorAnalysis
swot
cpmMatrix
positioningMaps
recommendations
```

When extending the schema, update both `buildAnalysisPrompt()` and the rendering logic in `Report.jsx`. Keep numeric scores on a `0–10` scale and keep positioning-map coordinates within the same range.

## Deployment

The project produces a static Vite bundle and can be deployed to any static hosting provider:

- Cloudflare Pages
- Vercel
- Netlify
- GitHub Pages
- Any Nginx or object-storage static host

Set the required environment variables in the hosting provider’s build environment. For production deployments, move API calls and authentication behind a server or edge function so API keys are not exposed in the browser.

### Cloudflare D1 project storage

This repository includes a Pages Function at `functions/api/projects.js`, a D1 migration at `migrations/0001_init.sql`, and `wrangler.jsonc`. The current configuration contains the D1 binding name `DB` and database ID. If you use a different database, replace those values before deploying.

For a CLI-based setup, install Wrangler with `pnpm add -D wrangler`, authenticate with `pnpm exec wrangler login`, and apply the migration with:

```bash
pnpm exec wrangler d1 migrations apply market-research --remote
pnpm build
pnpm exec wrangler pages deploy dist
```

If the project is connected to Cloudflare Pages through Git, the normal Pages deployment will include the `functions/` directory. In the Pages dashboard, bind the D1 database using the exact binding name `DB`. The React app uses `/api/projects` when the Pages Function is available and falls back to browser storage for local development.

## Contributing

Contributions are welcome. A typical workflow is:

```bash
git checkout -b feature/your-improvement
pnpm install
pnpm lint
pnpm build
git commit -m "feat: describe your change"
git push origin feature/your-improvement
```

Please keep pull requests focused, include reproduction steps for bug fixes, and avoid committing credentials, generated build files, or private research data.

## Roadmap

- Server-backed authentication and encrypted project storage
- Full print/export mode for the entire multi-tab report
- More social-platform collectors and provider adapters
- Persistent research history and comparison across report versions
- TypeScript schema validation for AI responses
- Automated chart and report export to PDF

## License

This project is currently distributed without a license file. Before publishing it as an open-source project, add a license such as MIT, Apache-2.0, or AGPL-3.0 according to your intended usage and contribution model.

## Disclaimer

AI-generated research is an assistive input, not a substitute for primary research, legal advice, financial advice, or professional market validation. Verify important claims and links before relying on them.
