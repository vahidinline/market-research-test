export function validateStructure(value, rows) {
  if (!Array.isArray(value?.businessModels) || !Array.isArray(value.subindustries) || !Array.isArray(value.classifications)) throw new Error('ساختار طبقه‌بندی بازار ناقص است.');
  const ids = new Set(rows.map(row => row.id));
  const models = new Set(value.businessModels.map(model => model.name));
  const categories = new Set(value.subindustries.map(item => item.name));
  const seen = new Set();
  for (const item of value.classifications) {
    if (!ids.has(item.businessId) || seen.has(item.businessId)) throw new Error('شناسه کسب‌وکار تکراری یا خارج از دسته است.');
    seen.add(item.businessId);
    if (typeof item.relevant !== 'boolean') throw new Error('وضعیت ارتباط کسب‌وکار باید مشخص باشد.');
    if (item.relevant && (!models.has(item.businessModel) || !categories.has(item.subindustry))) throw new Error('ارجاع مدل یا زیرشاخه نامعتبر است.');
  }
  if (seen.size !== ids.size) throw new Error('طبقه‌بندی بعضی کسب‌وکارهای دسته جا افتاده است.');
  for (const item of [...value.businessModels, ...value.subindustries]) if (!Array.isArray(item.businessIds) || item.businessIds.some(id => !ids.has(id))) throw new Error('نمونه‌های مدل یا زیرشاخه نامعتبر است.');
  return value;
}
export function mergeStructures(parts) {
  const merge = key => {
    const map = new Map();
    for (const part of parts) for (const item of part[key] || []) {
      const existing = map.get(item.name);
      map.set(item.name, existing ? { ...existing, businessIds: [...new Set([...existing.businessIds, ...item.businessIds])] } : structuredClone(item));
    }
    return [...map.values()];
  };
  return { industryOverview: parts.map(part => part.industryOverview || '').join('\n\n'), industryDefinition: parts[0]?.industryDefinition || '', businessModels: merge('businessModels'), subindustries: merge('subindustries'), classifications: parts.flatMap(part => part.classifications) };
}
export function placementContext(structure, evidence) {
  const models = structure.businessModels.slice(0, 12).map(model => ({ name: model.name, definition: String(model.definition || '').slice(0, 400), modelType: model.modelType, businessIds: model.businessIds.slice(0, 3) }));
  const ids = new Set(models.flatMap(model => model.businessIds));
  return { structure: { industryDefinition: structure.industryDefinition.slice(0, 1000), businessModels: models, subindustries: structure.subindustries.slice(0, 12).map(item => ({ name: item.name, businessIds: item.businessIds.filter(id => ids.has(id)) })) }, evidence: Object.fromEntries([...ids].map(id => [id, { signals: evidence[id]?.signals || {}, evidence: (evidence[id]?.evidence || []).slice(0, 2).map(item => ({ ...item, text: String(item.text || '').slice(0, 220) })) }])), totalModels: structure.businessModels.length, suppliedModels: models.length };
}
export function validatePlacement(value, context) {
  const models = new Set(context.structure.businessModels.map(item => item.name));
  const ids = new Set(context.structure.businessModels.flatMap(item => item.businessIds));
  if (!value?.targetPlacement || !models.has(value.targetPlacement.businessModel) || !value.targetSubindustryBrief || !Array.isArray(value.targetSubindustryBrief.businessModels)) throw new Error('جایگاه هدف به مدل معتبر ارجاع نمی‌دهد.');
  for (const item of value.targetSubindustryBrief.businessModels) if (!models.has(item.name) || !Array.isArray(item.caseBusinessIds) || !item.caseBusinessIds.length || item.caseBusinessIds.some(id => !ids.has(id))) throw new Error('نمونه‌های جایگاه فاقد شواهد معتبر است.');
  return value;
}
