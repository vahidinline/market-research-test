import PptxGenJS from 'pptxgenjs';

const C = { ink: '132127', paper: 'F3F0E8', acid: 'B4E665', teal: '58C6BD', orange: 'F2B35F', muted: '75868A', line: 'D9D8D0', red: 'D86F5F' };
const FONT = 'Vazirmatn';
const safe = (value) => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
const fileSlug = (value) => safe(value).replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 64) || 'market-research';

function addFooter(slide, index, total, target) {
  slide.addText(safe(target?.name || 'Market Research'), { x: 0.55, y: 7.08, w: 4.8, h: 0.18, fontFace: FONT, fontSize: 8, color: C.muted, margin: 0, rtlMode: true });
  slide.addText(`${String(index).padStart(2, '0')} / ${String(total).padStart(2, '0')}`, { x: 11.75, y: 7.08, w: 1, h: 0.18, fontFace: 'DM Mono', fontSize: 8, color: C.muted, margin: 0, align: 'right' });
}

function addTitle(slide, title, kicker, dark = false) {
  slide.addText(safe(kicker).toUpperCase(), { x: 0.65, y: 0.42, w: 5.8, h: 0.24, fontFace: 'DM Mono', fontSize: 9, color: dark ? C.acid : C.teal, charSpacing: 1.2, margin: 0 });
  slide.addText(safe(title), { x: 0.65, y: 0.8, w: 12, h: 0.62, fontFace: FONT, fontSize: 28, bold: true, color: dark ? C.paper : C.ink, margin: 0, rtlMode: true, align: 'right', breakLine: false, fit: 'shrink' });
}

function notesFor(slide) {
  const sources = slide.sources?.length ? `\n\n[Sources]\n${slide.sources.join('\n')}\n[/Sources]` : '\n\n[Sources]\nگزارش داخلی پروژه؛ منبع خارجی مستقلی در این اسلاید استفاده نشده است.\n[/Sources]';
  return `${safe(slide.speakerNotes || slide.claim)}${sources}`;
}

function addBulletList(slide, bullets, options = {}) {
  const rows = (bullets || []).slice(0, 5).map((text) => ({ text: safe(text), options: { bullet: { indent: 18 }, hanging: 4, breakLine: true } }));
  slide.addText(rows.length ? rows : [{ text: 'داده کافی برای این بخش ثبت نشده است.' }], { x: options.x ?? 1.05, y: options.y ?? 2.15, w: options.w ?? 11.2, h: options.h ?? 3.7, fontFace: FONT, fontSize: options.fontSize ?? 21, color: options.color ?? C.ink, breakLine: false, margin: 0.08, paraSpaceAfterPt: 15, rtlMode: true, valign: 'mid', fit: 'shrink' });
}

function renderCover(pptx, spec, target) {
  const slide = pptx.addSlide();
  slide.background = { color: C.ink };
  slide.addShape(pptx.ShapeType.rect, { x: 0.65, y: 0.7, w: 0.1, h: 5.9, fill: { color: C.acid }, line: { color: C.acid } });
  slide.addText('MARKET RESEARCH / EXECUTIVE DECK', { x: 1.05, y: 0.82, w: 6.5, h: 0.3, fontFace: 'DM Mono', fontSize: 11, color: C.acid, charSpacing: 1.4, margin: 0 });
  slide.addText(safe(spec.title), { x: 1.02, y: 1.55, w: 10.9, h: 2.05, fontFace: FONT, fontSize: 40, bold: true, color: C.paper, margin: 0, rtlMode: true, align: 'right', valign: 'mid', fit: 'shrink' });
  slide.addText(safe(spec.subtitle || target?.industry), { x: 1.05, y: 4.18, w: 8.7, h: 0.65, fontFace: FONT, fontSize: 20, color: 'AFC0BB', margin: 0, rtlMode: true, align: 'right', fit: 'shrink' });
  slide.addText(new Date().toLocaleDateString('fa-IR'), { x: 10.6, y: 6.35, w: 1.7, h: 0.25, fontFace: FONT, fontSize: 10, color: C.muted, margin: 0, align: 'right' });
  slide.addNotes(notesFor(spec));
}

function renderStatement(pptx, spec, index, total, target) {
  const slide = pptx.addSlide(); slide.background = { color: C.paper };
  addTitle(slide, spec.title, 'KEY TAKEAWAY');
  slide.addText('“', { x: 0.72, y: 1.65, w: 0.7, h: 0.65, fontFace: 'Georgia', fontSize: 54, color: C.acid, margin: 0 });
  slide.addText(safe(spec.claim || spec.bullets?.[0]), { x: 1.45, y: 1.72, w: 10.7, h: 3.4, fontFace: FONT, fontSize: 30, bold: true, color: C.ink, margin: 0, rtlMode: true, align: 'right', valign: 'mid', fit: 'shrink' });
  addFooter(slide, index, total, target); slide.addNotes(notesFor(spec));
}

function renderItems(pptx, spec, index, total, target) {
  const slide = pptx.addSlide(); slide.background = { color: C.paper }; addTitle(slide, spec.title, spec.layout.toUpperCase());
  const items = spec.items?.length ? spec.items.slice(0, 6) : (spec.bullets || []).slice(0, 6).map((x, i) => ({ label: `${i + 1}`, value: x, detail: '' }));
  const cols = items.length <= 3 ? items.length : 3; const rows = Math.ceil(items.length / cols); const colW = 11.7 / Math.max(cols, 1); const rowH = 4.7 / Math.max(rows, 1);
  items.forEach((item, i) => { const col = i % cols; const row = Math.floor(i / cols); const x = 0.8 + col * colW; const y = 1.72 + row * rowH;
    slide.addText(safe(item.label), { x, y, w: colW - 0.25, h: 0.28, fontFace: 'DM Mono', fontSize: 10, color: C.teal, margin: 0, rtlMode: true, align: 'right', fit: 'shrink' });
    slide.addText(safe(item.value), { x, y: y + 0.43, w: colW - 0.25, h: 0.82, fontFace: FONT, fontSize: 22, bold: true, color: C.ink, margin: 0, rtlMode: true, align: 'right', fit: 'shrink' });
    if (item.detail) slide.addText(safe(item.detail), { x, y: y + 1.34, w: colW - 0.25, h: Math.max(0.42, rowH - 1.55), fontFace: FONT, fontSize: 13, color: C.muted, margin: 0, rtlMode: true, align: 'right', fit: 'shrink' });
    if (col < cols - 1) slide.addShape(pptx.ShapeType.line, { x: x + colW - 0.12, y, w: 0, h: rowH - 0.3, line: { color: C.line, width: 1 } });
  });
  addFooter(slide, index, total, target); slide.addNotes(notesFor(spec));
}

function renderBullets(pptx, spec, index, total, target) {
  const slide = pptx.addSlide(); slide.background = { color: C.paper }; addTitle(slide, spec.title, 'ANALYSIS');
  if (spec.claim) slide.addText(safe(spec.claim), { x: 0.95, y: 1.65, w: 11.4, h: 0.75, fontFace: FONT, fontSize: 21, bold: true, color: C.ink, margin: 0, rtlMode: true, align: 'right', fit: 'shrink' });
  addBulletList(slide, spec.bullets, { y: spec.claim ? 2.65 : 1.75, h: spec.claim ? 3.6 : 4.5 });
  addFooter(slide, index, total, target); slide.addNotes(notesFor(spec));
}

function renderSwot(pptx, spec, index, total, target) {
  const slide = pptx.addSlide(); slide.background = { color: C.paper }; addTitle(slide, spec.title, 'SWOT');
  const items = (spec.items || []).slice(0, 4); const colors = [C.acid, C.orange, C.teal, C.red];
  items.forEach((item, i) => { const x = 0.75 + (i % 2) * 6.1; const y = 1.65 + Math.floor(i / 2) * 2.45;
    slide.addShape(pptx.ShapeType.line, { x, y, w: 5.55, h: 0, line: { color: colors[i], width: 3 } });
    slide.addText(safe(item.label || item.value), { x, y: y + 0.2, w: 5.55, h: 0.42, fontFace: FONT, fontSize: 20, bold: true, color: C.ink, margin: 0, rtlMode: true, align: 'right', fit: 'shrink' });
    slide.addText(safe(item.detail || item.value), { x, y: y + 0.8, w: 5.55, h: 1.15, fontFace: FONT, fontSize: 14, color: C.muted, margin: 0, rtlMode: true, align: 'right', fit: 'shrink' });
  });
  addFooter(slide, index, total, target); slide.addNotes(notesFor(spec));
}

function renderClosing(pptx, spec, target) {
  const slide = pptx.addSlide(); slide.background = { color: C.ink };
  slide.addText('NEXT MOVE', { x: 0.75, y: 0.75, w: 3, h: 0.28, fontFace: 'DM Mono', fontSize: 10, color: C.acid, charSpacing: 1.4, margin: 0 });
  slide.addText(safe(spec.title), { x: 0.75, y: 1.45, w: 11.8, h: 1.4, fontFace: FONT, fontSize: 38, bold: true, color: C.paper, margin: 0, rtlMode: true, align: 'right', fit: 'shrink' });
  slide.addText(safe(spec.claim || spec.subtitle), { x: 2.4, y: 3.55, w: 9.9, h: 1.45, fontFace: FONT, fontSize: 24, color: 'BFD0CA', margin: 0, rtlMode: true, align: 'right', fit: 'shrink' });
  slide.addShape(pptx.ShapeType.line, { x: 0.75, y: 6.55, w: 11.8, h: 0, line: { color: C.acid, width: 2 } });
  slide.addText(safe(target?.name), { x: 9.5, y: 6.72, w: 3, h: 0.25, fontFace: FONT, fontSize: 10, color: C.muted, margin: 0, rtlMode: true, align: 'right' });
  slide.addNotes(notesFor(spec));
}

export async function exportPresentation(plan, target) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; pptx.rtlMode = true; pptx.author = 'Market Research AI'; pptx.company = safe(target?.name); pptx.subject = safe(target?.industry); pptx.title = safe(plan.deckTitle); pptx.lang = 'fa-IR';
  pptx.theme = { headFontFace: FONT, bodyFontFace: FONT, lang: 'fa-IR' };
  const slides = plan.slides || []; const total = slides.length;
  slides.forEach((spec, i) => {
    if (i === 0 || spec.layout === 'cover') return renderCover(pptx, spec, target);
    if (i === total - 1 || spec.layout === 'closing') return renderClosing(pptx, spec, target);
    if (spec.layout === 'statement') return renderStatement(pptx, spec, i + 1, total, target);
    if (spec.layout === 'swot') return renderSwot(pptx, spec, i + 1, total, target);
    if (['segments', 'competitors', 'cpm', 'recommendations'].includes(spec.layout)) return renderItems(pptx, spec, i + 1, total, target);
    return renderBullets(pptx, spec, i + 1, total, target);
  });
  const fileName = `${fileSlug(target?.name)}-market-research.pptx`;
  await pptx.writeFile({ fileName, compression: true });
  return { fileName, slideCount: total };
}
