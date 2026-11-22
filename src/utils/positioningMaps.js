import { buildCpmPositioningMaps } from './cpm.js';
import { completeCpmEstimates } from './cpmEstimates.js';

export function reportPositioningMaps(report) {
  if (!report.cpmModel) return report.positioningMaps || [];
  const matrix = report.cpmEstimation?.enabled
    ? completeCpmEstimates(report.cpmModel, report.cpmMatrix, report.cpmEstimation.narratives)
    : report.cpmMatrix;
  return buildCpmPositioningMaps(report.cpmModel, matrix);
}

// Move only the drawn symbol; tooltips and tables retain the exact scores.
export function layoutPositioningMarkers(points, domain, width, height) {
  const placed = [];
  const span = domain[1] - domain[0];
  return points.map(point => {
    const x = (point.x - domain[0]) / span * width;
    const y = (domain[1] - point.y) / span * height;
    let candidate = { x, y };
    for (let step = 0; step < 2000; step++) {
      const radius = step === 0 ? 0 : 4 * Math.sqrt(step);
      const angle = step * 2.399963;
      candidate = { x: x + radius * Math.cos(angle), y: y + radius * Math.sin(angle) };
      if (candidate.x < 0 || candidate.x > width || candidate.y < 0 || candidate.y > height) continue;
      if (placed.every(other => Math.hypot(candidate.x - other.x, candidate.y - other.y) >= 28)) break;
    }
    placed.push(candidate);
    return { ...point, markerDx: candidate.x - x, markerDy: candidate.y - y };
  });
}

// Group coordinates as displayed in the table, without jittering real scores.
// Every member and its full-precision coordinates remain available in tooltips.
export function groupPositioningPoints(points, decimals = 2) {
  const groups = new Map();
  for (const point of points) {
    const key = `${point.x.toFixed(decimals)}:${point.y.toFixed(decimals)}`;
    if (!groups.has(key)) groups.set(key, { ...point, members: [], isTarget: false, estimated: false });
    const group = groups.get(key);
    group.members.push(point);
    group.isTarget ||= point.isTarget;
    group.estimated ||= point.estimated;
  }
  return [...groups.values()];
}
