// AI BVF package download snapshot: live npm, PyPI and GitHub observations.
// Registry downloads include dependencies, repeat installs and automation.
// Usage: node scripts/adoption.mjs   (or: npm run adoption)
// Requires Node 18+ (native fetch).
// Behind an HTTPS proxy, run with NODE_USE_ENV_PROXY=1 (Node >= 22.21).
// native fetch ignores HTTPS_PROXY otherwise.

const JS_PKG    = '@aibvf/core';
const MCP_PKG   = 'aibvf-mcp';
const CHECK_PKG = 'aibvf-check';
const PY_PKG    = 'aibvf';
const GH_REPO   = 'Craig-Horton/ai-bvf';

const unavailable = new Map();
const requestedAt = new Date().toISOString();

async function json(url) {
  const headers = {};
  if (process.env.GITHUB_TOKEN && url.includes('api.github.com')) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  try {
    const r = await fetch(url, { headers });
    if (!r.ok) {
      unavailable.set(url, `HTTP ${r.status}`);
      return null;
    }
    return await r.json();
  } catch {
    unavailable.set(url, 'network or JSON response error');
    return null;
  }
}

async function npmDownloads(pkg, period) {
  const d = await json(`https://api.npmjs.org/downloads/point/${period}/${encodeURIComponent(pkg)}`);
  if (!Number.isSafeInteger(d?.downloads) || d.downloads < 0
      || !/^\d{4}-\d{2}-\d{2}$/.test(d?.start ?? '')
      || !/^\d{4}-\d{2}-\d{2}$/.test(d?.end ?? '')) {
    if (d) unavailable.set(`npm:${pkg}:${period}`, 'invalid count or reporting dates');
    return null;
  }
  return { downloads: d.downloads, start: d.start, end: d.end };
}

async function githubStats(repo) {
  const d = await json(`https://api.github.com/repos/${repo}`);
  if (!d) return null;
  return {
    stars: d.stargazers_count,
    forks: d.forks_count,
    watchers: d.subscribers_count,
    openIssues: d.open_issues_count,
    updatedAt: d.updated_at?.slice(0, 10),
  };
}

async function pypiStats(pkg) {
  // pypistats.org (public, no auth). Returns 404 until the package is published.
  const d = await json(`https://pypistats.org/api/packages/${pkg}/recent`);
  return d ? { ...d.data, fetchedAt: new Date().toISOString() } : null;
}

function pad(n, w = 7) { return n == null ? ('n/a'.padStart(w, ' ')) : String(n).padStart(w, ' '); }
const downloads = (point) => point?.downloads ?? null;

const [jsD, jsW, jsM, mcpD, mcpW, mcpM, ckD, ckW, ckM, py, gh] = await Promise.all([
  npmDownloads(JS_PKG, 'last-day'),
  npmDownloads(JS_PKG, 'last-week'),
  npmDownloads(JS_PKG, 'last-month'),
  npmDownloads(MCP_PKG, 'last-day'),
  npmDownloads(MCP_PKG, 'last-week'),
  npmDownloads(MCP_PKG, 'last-month'),
  npmDownloads(CHECK_PKG, 'last-day'),
  npmDownloads(CHECK_PKG, 'last-week'),
  npmDownloads(CHECK_PKG, 'last-month'),
  pypiStats(PY_PKG),
  githubStats(GH_REPO),
]);

// Raw package-download sums can count dependencies from the same install twice.
// Suppress incomplete sums when any package count is unavailable.
const sum = (...points) => points.every((p) => p && p.start === points[0].start && p.end === points[0].end)
  ? points.reduce((total, point) => total + point.downloads, 0) : null;
const [npmD, npmW, npmM] = [sum(jsD, mcpD, ckD), sum(jsW, mcpW, ckW), sum(jsM, mcpM, ckM)];

const line = '─'.repeat(56);
console.log('\nAI BVF · package download snapshot · ' + requestedAt);
console.log(line);
console.log('npm downloads           day     week    month');
console.log(line);
console.log(`  @aibvf/core       ${pad(downloads(jsD))}  ${pad(downloads(jsW))}  ${pad(downloads(jsM))}`);
console.log(`  aibvf-mcp         ${pad(downloads(mcpD))}  ${pad(downloads(mcpW))}  ${pad(downloads(mcpM))}`);
console.log(`  aibvf-check       ${pad(downloads(ckD))}  ${pad(downloads(ckW))}  ${pad(downloads(ckM))}`);
console.log(`  raw download sum  ${pad(npmD)}  ${pad(npmW)}  ${pad(npmM)}`);
console.log(line);
console.log('Counts include repeat installs, dependencies and automation.');
console.log('Counts measure package retrievals; one installation can retrieve several packages.');
console.log('Raw sums require all package counts and matching reporting dates.');
console.log('npm reporting dates (inclusive, returned by the registry):');
for (const [label, points] of [
  ['day', [jsD, mcpD, ckD]], ['week', [jsW, mcpW, ckW]], ['month', [jsM, mcpM, ckM]],
]) {
  const windows = [...new Set(points.filter(Boolean).map((p) => `${p.start} to ${p.end}`))];
  console.log(`  ${label}: ${windows.join('; ') || 'unavailable'}${points.some((p) => !p) ? ' (incomplete)' : ''}`);
}
console.log(line);
console.log('PyPI downloads          day     week    month');
console.log(`  aibvf             ${pad(py?.last_day)}  ${pad(py?.last_week)}  ${pad(py?.last_month)}`);
console.log('PyPI periods are provider-defined recent windows; exact dates are not supplied.');
console.log(`PyPI fetched: ${py?.fetchedAt ?? 'unavailable'}`);
console.log(line);
if (gh) {
  console.log(`GitHub · ${GH_REPO}`);
  console.log(`  stars:     ${gh.stars}`);
  console.log(`  forks:     ${gh.forks}`);
  console.log(`  watchers:  ${gh.watchers}`);
  console.log(`  open issues/PRs: ${gh.openIssues}`);
  console.log(`  updated: ${gh.updatedAt}`);
} else {
  console.log('GitHub: rate limited or unreachable.');
}
if (unavailable.size) {
  console.log();
  console.log('Unavailable sources (n/a indicates missing data):');
  for (const [source, reason] of unavailable) console.log(`  ${source}: ${reason}`);
}
console.log();
console.log('Usage and return-use evidence: run supabase/queries/adoption-retention.sql.');
console.log('That report separates connection-only IDs, tool-using IDs and repeat tool use.');
console.log('Browser saves are local to a device; portfolio handoffs and imports are separate.');
console.log('Telemetry covers observed IDs and can include internal or automated activity.');
console.log('Definitions and limits: docs/adoption-metrics.md');
console.log(`Snapshot completed: ${new Date().toISOString()}`);
console.log();
console.log('Dashboards:');
console.log(`  npm (core):   https://www.npmjs.com/package/${JS_PKG}`);
console.log(`  npm (mcp):    https://www.npmjs.com/package/${MCP_PKG}`);
console.log(`  npm (check):  https://www.npmjs.com/package/${CHECK_PKG}`);
console.log(`  pypi:         https://pypi.org/project/${PY_PKG}/`);
console.log(`  github:       https://github.com/${GH_REPO}`);
console.log(`  npm-stat:     https://npm-stat.com/charts.html?package=${encodeURIComponent(JS_PKG)}&from=2026-04-19`);
console.log();
