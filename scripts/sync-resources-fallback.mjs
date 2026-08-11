import fs from 'node:fs/promises';
import path from 'node:path';
import { normalizeClassificationDocument } from '../src/lib/resourceClassification.js';

const SITE_ORIGIN = process.env.CXASCODE_SITE_ORIGIN || 'https://cxascode.github.io';
const RESOURCES_PATH = path.resolve('src/data/resources.json');
const HIDDEN_TYPES_PATH = path.resolve('src/data/hiddenResourceTypes.js');

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}): ${url}`);
  }

  return response.json();
}

function normalizeHiddenTypes(overrides) {
  const hidden = Array.isArray(overrides?.hiddenResourceTypes)
    ? overrides.hiddenResourceTypes.filter(type => typeof type === 'string' && type.trim())
    : [];

  return [...new Set(hidden.map(type => type.trim()))].sort();
}

function extractResourceTypes(catalog, excludedTypeSet) {
  const entries = Array.isArray(catalog?.resources) ? catalog.resources : [];

  return [...new Set(
    entries
      .map(entry => entry?.type)
      .filter(type => typeof type === 'string' && type.trim())
      .map(type => type.trim())
      .filter(type => !excludedTypeSet.has(type)),
  )].sort();
}

function buildHiddenTypesModule(hiddenResourceTypes) {
  const lines = hiddenResourceTypes.map(type => `  '${type}',`);
  return `export const HIDDEN_RESOURCE_TYPES_FALLBACK = [\n${lines.join('\n')}\n];\n`;
}

async function write() {
  const [catalog, overrides, classificationRaw] = await Promise.all([
    fetchJson(`${SITE_ORIGIN}/dependency-tree-merged-json/latest.json`),
    fetchJson(`${SITE_ORIGIN}/overrides.json`),
    fetchJson(`${SITE_ORIGIN}/resource-classification/latest.json`),
  ]);

  const hiddenResourceTypes = normalizeHiddenTypes(overrides);
  const classification = normalizeClassificationDocument(classificationRaw);
  const excludedTypeSet = new Set([
    ...hiddenResourceTypes,
    ...classification.nonExportableResourceTypes,
  ]);
  const resources = extractResourceTypes(catalog, excludedTypeSet);

  if (resources.length === 0) {
    throw new Error('No exportable resource types found in latest dependency catalog.');
  }

  await Promise.all([
    fs.writeFile(RESOURCES_PATH, `${JSON.stringify(resources, null, 2)}\n`, 'utf8'),
    fs.writeFile(HIDDEN_TYPES_PATH, buildHiddenTypesModule(hiddenResourceTypes), 'utf8'),
  ]);

  console.log(
    `Synced fallback data (exportable=${resources.length}, hidden=${hiddenResourceTypes.length}, nonExportable=${classification.nonExportableResourceTypes.length}, version=${catalog?.version || 'unknown'})`,
  );
}

write().catch(error => {
  console.error(error.message || error);
  process.exitCode = 1;
});
