export const REPORT_TABS = ['industry', 'directory', 'competitors', 'comparison', 'swot', 'cpm', 'maps', 'strategy', 'topics', 'sources'];
export function readReportRoute(href) {
  const url = new URL(href, 'https://market.example');
  const tab = url.searchParams.get('tab');
  return { projectId: url.searchParams.get('project') || null, tab: REPORT_TABS.includes(tab) ? tab : 'industry', owner: url.searchParams.get('panel') === 'owner' };
}
export function reportUrl(href, projectId, tab = 'industry') {
  const url = new URL(href, 'https://market.example');
  if (projectId) {
    url.searchParams.set('project', projectId);
    url.searchParams.set('tab', REPORT_TABS.includes(tab) ? tab : 'industry');
  } else {
    for (const key of ['project', 'tab', 'panel', 'token']) url.searchParams.delete(key);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
