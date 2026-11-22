import { buildCpmPositioningMaps } from './cpm.js';
import { completeCpmEstimates } from './cpmEstimates.js';

export function reportPositioningMaps(report) {
  if (!report.cpmModel) return report.positioningMaps || [];
  const matrix = report.cpmEstimation?.enabled
    ? completeCpmEstimates(report.cpmModel, report.cpmMatrix, report.cpmEstimation.narratives)
    : report.cpmMatrix;
  return buildCpmPositioningMaps(report.cpmModel, matrix);
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
