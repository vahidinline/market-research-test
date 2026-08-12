const json = (body, status=200) => new Response(JSON.stringify(body), {status, headers:{'content-type':'application/json'}});
const count = (html, pattern) => (html.match(pattern) || []).length;
const absoluteUrl = (base, value) => { try { return new URL(value, base).toString(); } catch { return ''; } };
const auditSeo = (html, parsed, response) => {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, '').trim() || '';
  const description = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1]?.trim() || '';
  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] || '';
  const h1 = count(html, /<h1\b/gi);
  const h2 = count(html, /<h2\b/gi);
  const images = count(html, /<img\b/gi);
  const imagesWithAlt = count(html, /<img\b[^>]*\balt=["'][^"']*["']/gi);
  const internalLinks = [...html.matchAll(/<a\b[^>]+href=["']([^"']+)["']/gi)].map((match) => absoluteUrl(parsed, match[1])).filter((url) => { try { return new URL(url).hostname === parsed.hostname; } catch { return false; } }).length;
  const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  const hasLang = /<html[^>]+\blang=["'][^"']+["']/i.test(html);
  const hasSchema = /application\/ld\+json|itemtype=["']https?:\/\/schema\.org/i.test(html);
  const hasRobots = /robots\.txt/i.test(html);
  const hasSitemap = /sitemap\.xml/i.test(html);
  const indexable = !/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html);
  const percent = (checks) => Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const onPage = percent([Boolean(title), Boolean(description), h1 === 1, Boolean(canonical), images === 0 || imagesWithAlt / images >= 0.7, internalLinks > 2, hasSchema]);
  const technical = percent([response.ok, parsed.protocol === 'https:', hasViewport, hasLang, indexable, hasRobots, hasSitemap]);
  return { onPage, technical, offPage: null, overall: Math.round((onPage * 0.55) + (technical * 0.45)), checks: { title, description, h1, h2, canonical: Boolean(canonical), images, imagesWithAlt, internalLinks, schema: hasSchema, https: parsed.protocol === 'https:', viewport: hasViewport, lang: hasLang, indexable, robots: hasRobots, sitemap: hasSitemap, status: response.status } };
};
export async function onRequestPost({ request }) {
  const { url } = await request.json();
  if (!url) return json({error:'url is required'},400);
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    const response = await fetch(parsed.toString(), { headers: { 'user-agent': 'MarketResearchBot/0.0.2' } });
    const html = await response.text();
    const text = html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || '';
    const seo = auditSeo(html, parsed, response);
    return json({ url: parsed.toString(), status: response.status, title, text: text.slice(0, 12000), hasBooking: /رزرو|booking|appointment|book now/i.test(html), hasContact: /contact|تماس با ما|ارتباط با ما/i.test(html), hasBlog: /blog|بلاگ/i.test(html), mobileMeta: seo.checks.viewport, seo });
  } catch (error) { return json({error: error.message}, 422); }
}
