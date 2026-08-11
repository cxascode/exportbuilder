import { CLASSIFICATION_KEYS, normalizeClassificationDocument, resolveExportableResourceTypes } from '../src/lib/resourceClassification.js';
import { getHiddenResourceTypes } from '../src/lib/siteOverrides.js';
import { parseResourceCatalog } from '../src/lib/resourceCatalog.js';

const SITE_ORIGIN = process.env.CXASCODE_SITE_ORIGIN || 'https://cxascode.github.io';

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}): ${response.status}`);
  }

  return response.json();
}

function assertClassificationSchema(classification) {
  const document = normalizeClassificationDocument(classification);

  for (const key of CLASSIFICATION_KEYS) {
    if (!Array.isArray(document[key])) {
      throw new Error(`Classification latest.json is missing array key: ${key}`);
    }
  }

  return document;
}

async function verify() {
  const dependencyTreeUrl = `${SITE_ORIGIN}/dependency-tree-merged-json/latest.json`;
  const classificationUrl = `${SITE_ORIGIN}/resource-classification/latest.json`;
  const overridesUrl = `${SITE_ORIGIN}/overrides.json`;

  const [catalogRaw, classificationRaw, overridesRaw] = await Promise.all([
    fetchJson(dependencyTreeUrl),
    fetchJson(classificationUrl),
    fetchJson(overridesUrl),
  ]);

  const hiddenTypes = getHiddenResourceTypes(overridesRaw);
  const catalog = parseResourceCatalog(catalogRaw, { hiddenTypes });
  const classification = assertClassificationSchema(classificationRaw);
  const exportable = resolveExportableResourceTypes(catalog.resourceTypes, classification, overridesRaw);

  if (exportable.length === 0) {
    throw new Error('Parsed dependency catalog did not contain any exportable resource types.');
  }

  console.log(
    `verify-public-data passed (exportable=${exportable.length}, catalog=${catalog.resourceTypes.length}, nonExportable=${classification.nonExportableResourceTypes.length})`,
  );
}

verify().catch(error => {
  console.error(error.message || error);
  process.exitCode = 1;
});
