import { buildResourceClassificationUrl, RESOURCE_CLASSIFICATION_INDEX_URL } from './publicDataUrls.js';
import {
  LATEST_DEPENDENCY_TREE_VERSION,
  normalizeDependencyTreeVersion,
} from './dependencyTreeVersions.js';

export { RESOURCE_CLASSIFICATION_INDEX_URL };

export const CLASSIFICATION_KEYS = [
  'deprecatedResourceTypes',
  'nonExportableResourceTypes',
  'cannotBeDestroyedResourceTypes',
];

function normalizeTypeList(values) {
  if (!Array.isArray(values)) return [];

  return [
    ...new Set(
      values
        .filter(entry => typeof entry === 'string')
        .map(entry => entry.trim())
        .filter(Boolean),
    ),
  ].sort((left, right) => left.localeCompare(right));
}

export function normalizeClassificationDocument(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      version: null,
      deprecatedResourceTypes: [],
      nonExportableResourceTypes: [],
      cannotBeDestroyedResourceTypes: [],
    };
  }

  return {
    version: value.version || null,
    deprecatedResourceTypes: normalizeTypeList(value.deprecatedResourceTypes),
    nonExportableResourceTypes: normalizeTypeList(value.nonExportableResourceTypes),
    cannotBeDestroyedResourceTypes: normalizeTypeList(value.cannotBeDestroyedResourceTypes),
  };
}

export function resolveClassificationTypeSets(classification, overrides = null) {
  const document = normalizeClassificationDocument(classification);
  const extras = overrides?.classificationExtras;

  return {
    deprecatedTypes: mergeClassificationTypes(document.deprecatedResourceTypes, extras?.deprecatedResourceTypes),
    nonExportableTypes: mergeClassificationTypes(
      document.nonExportableResourceTypes,
      extras?.nonExportableResourceTypes,
    ),
    cannotBeDestroyedTypes: mergeClassificationTypes(
      document.cannotBeDestroyedResourceTypes,
      extras?.cannotBeDestroyedResourceTypes,
    ),
  };
}

function mergeClassificationTypes(baseTypes, extraTypes) {
  return new Set([...normalizeTypeList(baseTypes), ...normalizeTypeList(extraTypes)]);
}

function parseVersionParts(version) {
  if (!version || version === LATEST_DEPENDENCY_TREE_VERSION) return null;

  const parts = String(version).split('.').map(value => Number.parseInt(value, 10));
  if (parts.length !== 3 || parts.some(value => Number.isNaN(value))) return null;

  return parts;
}

function compareVersionParts(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }

  return 0;
}

export function normalizeClassificationVersionList(index) {
  const entries = Array.isArray(index)
    ? index
    : Array.isArray(index?.versions)
      ? index.versions
      : [];

  return entries
    .map(entry => normalizeDependencyTreeVersion(typeof entry === 'string' ? entry : entry?.version))
    .filter(version => version && version !== LATEST_DEPENDENCY_TREE_VERSION);
}

export function resolveClassificationFileVersion(requestedVersion, availableVersions, catalogVersion = null) {
  const normalizedAvailable = normalizeClassificationVersionList(availableVersions);
  if (normalizedAvailable.length === 0) {
    return requestedVersion || LATEST_DEPENDENCY_TREE_VERSION;
  }

  const targetVersion = requestedVersion !== LATEST_DEPENDENCY_TREE_VERSION
    ? normalizeDependencyTreeVersion(requestedVersion)
    : catalogVersion
      ? normalizeDependencyTreeVersion(catalogVersion)
      : normalizedAvailable[0];

  if (!targetVersion || targetVersion === LATEST_DEPENDENCY_TREE_VERSION) {
    return LATEST_DEPENDENCY_TREE_VERSION;
  }

  if (normalizedAvailable.includes(targetVersion)) {
    return targetVersion;
  }

  const targetParts = parseVersionParts(targetVersion);
  if (!targetParts) return LATEST_DEPENDENCY_TREE_VERSION;

  const nearestLower = normalizedAvailable
    .map(version => ({ version, parts: parseVersionParts(version) }))
    .filter(entry => entry.parts && compareVersionParts(entry.parts, targetParts) <= 0)
    .sort((left, right) => compareVersionParts(right.parts, left.parts))[0];

  return nearestLower?.version || normalizedAvailable[normalizedAvailable.length - 1];
}

function filterToKnownTypes(types, knownResourceTypes) {
  if (!knownResourceTypes) return normalizeTypeList(types);

  const knownSet = new Set(knownResourceTypes);
  return normalizeTypeList(types).filter(type => knownSet.has(type));
}

/**
 * Catalog types the user can pick as tf_export include seeds.
 * Non-exportable types are omitted — same policy as Splitter core selection.
 */
export function resolveExportableResourceTypes(catalogResourceTypes, classification, overrides = null) {
  const { nonExportableTypes } = resolveClassificationTypeSets(classification, overrides);
  const nonExportable = filterToKnownTypes([...nonExportableTypes], catalogResourceTypes);

  return catalogResourceTypes.filter(type => !nonExportable.includes(type));
}

export async function fetchResourceClassificationDocument(version, {
  catalogVersion = null,
  availableVersions = null,
  signal = null,
} = {}) {
  let versions = availableVersions;

  if (!versions) {
    const indexResponse = await fetch(RESOURCE_CLASSIFICATION_INDEX_URL, {
      cache: 'no-store',
      signal,
    });

    if (!indexResponse.ok) {
      throw new Error(`Resource classification index request failed: ${indexResponse.status}`);
    }

    versions = await indexResponse.json();
  }

  const fileVersion = resolveClassificationFileVersion(version, versions, catalogVersion);
  const response = await fetch(buildResourceClassificationUrl(fileVersion), {
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    throw new Error(`Resource classification request failed: ${response.status}`);
  }

  return normalizeClassificationDocument(await response.json());
}
