import { runWebsiteCrawler } from './apify';

const cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const pageText = (item) => cleanText(item?.text || item?.markdown || item?.content || item?.body || '');
const pageTitle = (item) => cleanText(item?.title || item?.metadata?.title || item?.pageTitle || '');
const pageUrl = (item) => cleanText(item?.url || item?.loadedUrl || item?.metadata?.url || '');

function normalizeCrawl(items = []) {
  const seen = new Set();
  const pages = items.map((item) => ({ url: pageUrl(item), title: pageTitle(item), text: pageText(item) }))
    .filter((page) => page.url && page.text)
    .filter((page) => {
      if (seen.has(page.url)) return false;
      seen.add(page.url);
      return true;
    })
    .slice(0, 12)
    .map((page) => ({ ...page, text: page.text.slice(0, 6000) }));
  return {
    pages,
    pagesCrawled: pages.length,
    text: pages.map((page) => `URL: ${page.url}\nTITLE: ${page.title}\n${page.text}`).join('\n\n').slice(0, 48000),
    evidence: pages.map((page) => ({ url: page.url, title: page.title, excerpt: page.text.slice(0, 420) })),
  };
}

export async function inspectWebsite(url) {
  if (!url) return null;
  try {
    const staticAudit = await fetch('/api/website', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({url}) })
      .then((response) => response.ok ? response.json() : null)
      .catch(() => null);
    const crawlItems = await runWebsiteCrawler({
      startUrls: [{ url: /^https?:/i.test(url) ? url : `https://${url}` }],
      crawlerType: 'playwright:chrome',
      maxCrawlDepth: 2,
      maxCrawlPages: 12,
      saveMarkdown: true,
      saveHtml: false,
      saveScreenshots: false,
    });
    const crawl = normalizeCrawl(crawlItems);
    if (!staticAudit && !crawl.pagesCrawled) return null;
    return { ...(staticAudit || { url }), ...crawl, crawlStatus: 'collected' };
  } catch (error) {
    // The basic HTML audit remains useful when the optional crawler is unavailable.
    try {
      const response = await fetch('/api/website', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({url}) });
      return response.ok ? { ...(await response.json()), crawlStatus: 'unavailable', crawlError: error.message } : null;
    } catch { return null; }
  }
}
