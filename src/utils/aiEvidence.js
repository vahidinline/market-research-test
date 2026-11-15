// Keep evidence and metrics; never send scraper media trees to the model.
const omitted = /^(?:raw|rawData|html|images|image|displayUrl|displayResourceUrls|videoUrl|thumbnail|thumbnailUrl|profilePicUrl|profilePicUrlHD|childPosts|latestComments|relatedProfiles)$/i;

export function compactEvidence(value, budget = 16000) {
  let remaining = budget;
  const visit = (item, depth) => {
    if (remaining <= 0 || depth > 5 || item == null) return null;
    if (typeof item === 'string') {
      const text = item.slice(0, Math.min(1200, remaining));
      remaining -= text.length;
      return text;
    }
    if (typeof item === 'number' || typeof item === 'boolean') return item;
    if (Array.isArray(item)) return item.slice(0, 12).map((entry) => visit(entry, depth + 1)).filter((entry) => entry !== null);
    if (typeof item !== 'object') return null;
    const result = {};
    for (const [key, entry] of Object.entries(item)) {
      if (omitted.test(key) || remaining < key.length + 8) continue;
      remaining -= key.length + 8;
      const next = visit(entry, depth + 1);
      if (next !== null) result[key] = next;
    }
    return result;
  };
  return visit(value, 0);
}

export function compactInstagram(profile) {
  if (!profile) return null;
  const keys = ['username', 'fullName', 'biography', 'bio', 'externalUrl', 'businessCategoryName', 'categoryName', 'followersCount', 'followers', 'followsCount', 'postsCount', 'isVerified', 'isBusinessAccount', 'isPrivate', 'businessAddress', 'businessEmail'];
  return compactEvidence(Object.fromEntries(keys.filter((key) => profile[key] != null).map((key) => [key, profile[key]])), 4000);
}
