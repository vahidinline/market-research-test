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
- Instagram, LinkedIn, YouTube, and Reddit business/community links
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
- Azure Foundry for AI analysis
- Apify for Instagram profile collection
- pnpm for package management

## Getting started

### Requirements

- Node.js 20 or newer
- pnpm 9 or newer
- An Apify API token for live Instagram data
- An Azure Foundry API key for AI analysis

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

# Optional Apify Actor IDs for additional public platforms
VITE_APIFY_YOUTUBE_ACTOR=
VITE_APIFY_LINKEDIN_ACTOR=
VITE_APIFY_REDDIT_ACTOR=

# Server-side only: crawl website pages with rendered JavaScript when needed.
# Put this in Cloudflare Pages Secrets (or .dev.vars locally), not .env.local.
APIFY_WEBSITE_ACTOR=apify/website-content-crawler

# Server-side authentication: put these in .dev.vars, not Vite frontend env files
ROOT_EMAIL=your-email@example.com
ROOT_PASSWORD=change-this-password
```

Never commit `.env.local` or real credentials to a public repository.

Keep the Azure Foundry credentials in the Cloudflare Pages
Function environment (not in a `VITE_*` variable):

```env
AI_PROVIDER=azure
AZURE_OPENAI_ENDPOINT=https://automatune-resource.services.ai.azure.com/openai/v1/responses
AZURE_OPENAI_DEPLOYMENT=gpt-6-astra-1
AZURE_OPENAI_API_KEY=your_azure_api_key
```

For local Pages development, place these values in the git-ignored `.dev.vars`
file. In production, add `AZURE_OPENAI_API_KEY` as an encrypted Pages secret.

### Run locally

```bash
pnpm dev
```

Open `http://localhost:5173`. This command builds the frontend and starts the
Cloudflare worker routes used by Azure Foundry, Apify, projects, and website
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

The configured provider is Azure Foundry Responses API. The server selects
`AZURE_OPENAI_DEPLOYMENT`; old project model choices cannot redirect Azure calls.
The deployment name must match the Azure deployment, which may differ from the
resource name. The model selector lists this configured name without requesting
an upstream model catalogue. Use the connection test to verify credentials and deployment.

The supplied quota is 472 requests and 472,000 tokens per minute. Atomic D1
reservations share a rolling 60-second budget across Worker instances: 424
requests and 424,800 estimated tokens, plus 150ms spacing to reduce bursts.
Input UTF-8 bytes plus the maximum output and 512 tokens of overhead are reserved
conservatively, even when a call fails. This trades throughput for headroom;
it is not Azure's exact tokenizer or quota estimator. Other apps using the same
Azure quota remain outside this accounting. A shared cooldown honors Azure 429
Retry-After (including retry-after-ms), and the browser waits with jitter before
retrying. Quota responses (429) wait and retry without an attempt cap; they do
not consume the separate three-attempt budget for network/server failures. The
loading screen shows a neutral capacity-wait message instead of an error. This
execution runs while the page is open (also in a background tab); it is not a
server-side job that continues after closing the browser. Completed checkpoints
remain in D1 and can be resumed after reopening. Permanent errors still surface.
D1 quota tables are created automatically; no additional binding is required.
Missing quota storage prevents requests. Existing heartbeat transport remains
active while Azure generates its response, with a 180-second Azure upstream deadline and 210-second client deadline.
Azure Responses are streamed, and only the terminal completed response is accepted.

Local setup: add the key to `.dev.vars`, then restart `pnpm dev`. In production,
configure the encrypted Pages secret and redeploy. Never put the key in `VITE_*`.
The older router path remains for compatibility when Azure is explicitly disabled
and its secret is absent; the checked-in Wrangler configuration enables Azure.

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

Authentication is server-backed: users and sessions are stored in D1, and passwords are hashed with PBKDF2. Configure `ROOT_EMAIL` and `ROOT_PASSWORD` in `.dev.vars` locally or server secrets in production. The root account is created only if its email does not already exist; changing the environment password does not reset an existing account.

Run `pnpm dev` for local login and API support. `pnpm dev:frontend` runs only Vite and cannot handle `/api/auth/*`. Legacy `VITE_AUTH_*` variables do not configure the current password. Keep authentication credentials out of frontend environment files.

## SendPulse invitation emails

The invite endpoint supports either a static SendPulse API key or OAuth client credentials. Configure one of these sets as Cloudflare Pages secrets (do not put them in `VITE_*` variables):

```sh
npx wrangler pages secret put SENDPULSE_API_KEY
# Or, instead of a static key:
npx wrangler pages secret put SENDPULSE_CLIENT_ID
npx wrangler pages secret put SENDPULSE_CLIENT_SECRET

npx wrangler pages secret put SENDPULSE_FROM_EMAIL
npx wrangler pages secret put SENDPULSE_FROM_NAME
```

`SENDPULSE_FROM_EMAIL` must be an active sender that is approved for SendPulse SMTP. The archive shows whether an email and invite status were stored remotely; a browser-only save cannot create a usable client link on another device.

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
