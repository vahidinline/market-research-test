import { spawnSync } from 'node:child_process';

const project = 'market-research-roxi';
const required = ['AZURE_OPENAI_API_KEY', 'APIFY_API_KEY', 'ROOT_EMAIL', 'ROOT_PASSWORD', 'SENDPULSE_API_KEY'];
function run(args, capture = false) {
  const result = spawnSync('pnpm', args, { stdio: capture ? 'pipe' : 'inherit', encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Command failed: pnpm ${args.join(' ')}${capture ? `\n${result.stderr}` : ''}`);
  return result.stdout || '';
}

// Plain-text dashboard settings can be replaced by wrangler vars during deploy.
// Critical credentials must be encrypted server secrets before uploading assets.
const listed = run(['exec', 'wrangler', 'pages', 'secret', 'list', '--project-name', project], true);
const missing = required.filter(name => !new RegExp(`\\b${name}\\b`).test(listed));
if (missing.length) throw new Error(`Deployment blocked: missing encrypted production secrets: ${missing.join(', ')}`);
run(['build']);
run(['exec', 'wrangler', 'pages', 'deploy', 'dist', '--project-name', project, '--branch', 'main', '--commit-dirty=true']);
// GET validates configuration without running a paid Azure request.
let healthy = false;
for (let attempt = 0; attempt < 6; attempt++) {
  try {
    const response = await fetch('https://market.roxiapp.online/api/ai', { signal: AbortSignal.timeout(15000), cache: 'no-store' });
    const body = await response.json();
    if (response.ok && body.ok && body.provider === 'azure' && body.models?.length) { healthy = true; break; }
  } catch { /* Retry propagation/network failures, but never report success. */ }
  if (attempt < 5) await new Promise(resolve => setTimeout(resolve, 5000));
}
if (!healthy) throw new Error('Production AI configuration health check failed after deployment.');
console.log('Production deployment and Azure configuration health check passed.');
