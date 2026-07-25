export function cleanName(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function sanitizeExportName(value) {
  const sanitized = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[-_]+|[-_]+$/g, '');

  if (!sanitized) return '';

  if (/^[0-9]/.test(sanitized)) {
    return `_${sanitized}`;
  }

  return sanitized;
}

export const CORE_EXPORT_NAME = 'tf_export';

export function getTfExportResourceName(exportName) {
  return sanitizeExportName(exportName) || CORE_EXPORT_NAME;
}

export function getTfExportDirectory(tfExportResourceName) {
  if (tfExportResourceName === CORE_EXPORT_NAME) {
    return './genesyscloud';
  }

  return `./genesyscloud-${tfExportResourceName}`;
}

export function getAssignedResources(exports) {
  return new Map(exports.flatMap(exportItem => getExportResources(exportItem).map(resource => [resource, exportItem.name])));
}

export function getFirstLevelDependencies({ selectedResources, dependencyMap }) {
  const selectedSet = new Set(selectedResources);
  const dependencies = new Set();

  selectedResources.forEach(resource => {
    (dependencyMap.get(resource) || []).forEach(dependency => {
      if (!selectedSet.has(dependency)) {
        dependencies.add(dependency);
      }
    });
  });

  return [...dependencies].sort();
}

export function getExportResources(exportItem) {
  if (!exportItem) return [];
  return Array.isArray(exportItem.selectedResources) ? exportItem.selectedResources : [];
}

export function getAvailableExportResources({ resources, assigned, query }) {
  return resources
    .filter(resource => !assigned.has(resource))
    .filter(resource => resource.includes(query));
}

export function getExportStats({ resources, exports, assigned }) {
  return {
    knownResourceCount: resources.length,
    selectedResourceCount: exports.reduce((total, exportItem) => total + getExportResources(exportItem).length, 0),
    availableResourceCount: resources.filter(resource => !assigned.has(resource)).length,
  };
}

export function validateExports({ exports }) {
  const assignmentCounts = new Map();

  exports.forEach(exportItem => {
    getExportResources(exportItem).forEach(resource => {
      assignmentCounts.set(resource, (assignmentCounts.get(resource) || 0) + 1);
    });
  });

  const duplicates = [...assignmentCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([resource]) => resource);

  return {
    duplicates,
    ok: duplicates.length === 0,
  };
}
