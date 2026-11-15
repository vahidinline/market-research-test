export function shouldResumeDraft(draft) {
  if (!draft) return false;
  return draft.stage !== 'form' || Boolean(draft.error || draft.profilesData || draft.preliminary || draft.approvedModel) || Object.values(draft.chunks || {}).some((chunks) => Object.keys(chunks || {}).length > 0);
}

export function normalizeDraft(draft) {
  return { ...draft, chunks: { ...(draft.chunks || {}), methodology: draft.chunks?.methodology || {}, completion: draft.chunks?.completion || {} } };
}
