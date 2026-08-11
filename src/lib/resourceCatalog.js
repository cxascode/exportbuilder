import { HIDDEN_RESOURCE_TYPES_FALLBACK } from '../data/hiddenResourceTypes.js';

const DEFAULT_HIDDEN_RESOURCE_TYPES = new Set(HIDDEN_RESOURCE_TYPES_FALLBACK);

function isIncludedResourceType(type, hiddenTypes) {
  return type && !hiddenTypes.has(type);
}

export function parseResourceCatalog(catalog, { hiddenTypes = DEFAULT_HIDDEN_RESOURCE_TYPES } = {}) {
  const entries = Array.isArray(catalog?.resources) ? catalog.resources : [];
  const excludedTypes = hiddenTypes instanceof Set ? hiddenTypes : new Set(hiddenTypes);

  const resources = entries
    .map(resource => ({
      name: resource.name || resource.type,
      type: resource.type,
      dependencies: Array.isArray(resource.dependencies) ? resource.dependencies : [],
    }))
    .filter(resource => isIncludedResourceType(resource.type, excludedTypes))
    .sort((left, right) => left.type.localeCompare(right.type));

  return buildResourceCatalog({
    version: catalog?.version || null,
    resources,
  });
}

export function buildResourceCatalog({ version = null, resources = [] }) {
  const resourceTypes = resources.map(resource => resource.type);
  const resourceTypeSet = new Set(resourceTypes);

  const dependencyMap = new Map(resources.map(resource => [
    resource.type,
    resource.dependencies.filter(dependency => resourceTypeSet.has(dependency)),
  ]));

  return {
    version,
    resources,
    resourceTypes,
    dependencyMap,
  };
}

export function buildFallbackCatalog(resourceTypes, { hiddenTypes = DEFAULT_HIDDEN_RESOURCE_TYPES } = {}) {
  const excludedTypes = hiddenTypes instanceof Set ? hiddenTypes : new Set(hiddenTypes);

  return buildResourceCatalog({
    version: null,
    resources: resourceTypes.filter(type => isIncludedResourceType(type, excludedTypes)).map(type => ({
      name: type,
      type,
      dependencies: [],
    })),
  });
}
