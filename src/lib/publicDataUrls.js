export const SITE_ORIGIN = 'https://cxascode.github.io';
export const MIN_DEPENDENCY_TREE_VERSION = '1.60.0';
export const LATEST_VERSION_ALIAS = 'latest';

export const DEPENDENCY_TREE_MERGED_DIR = 'dependency-tree-merged-json';
export const RESOURCE_CLASSIFICATION_DIR = 'resource-classification';

export const DEPENDENCY_TREE_INDEX_URL = `${SITE_ORIGIN}/${DEPENDENCY_TREE_MERGED_DIR}/index.json`;
export const RESOURCE_CLASSIFICATION_INDEX_URL = `${SITE_ORIGIN}/${RESOURCE_CLASSIFICATION_DIR}/index.json`;
export const OVERRIDES_URL = `${SITE_ORIGIN}/overrides.json`;

export function buildDependencyTreeUrl(version = LATEST_VERSION_ALIAS) {
  if (!version || version === LATEST_VERSION_ALIAS) {
    return `${SITE_ORIGIN}/${DEPENDENCY_TREE_MERGED_DIR}/latest.json`;
  }

  return `${SITE_ORIGIN}/${DEPENDENCY_TREE_MERGED_DIR}/${version}.json`;
}

export function buildResourceClassificationUrl(version = LATEST_VERSION_ALIAS) {
  if (!version || version === LATEST_VERSION_ALIAS) {
    return `${SITE_ORIGIN}/${RESOURCE_CLASSIFICATION_DIR}/latest.json`;
  }

  return `${SITE_ORIGIN}/${RESOURCE_CLASSIFICATION_DIR}/${version}.json`;
}
