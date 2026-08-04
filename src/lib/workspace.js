import { getTfExportResourceName } from './resourceModel.js';
import { extractResourceType, parsePastedResourceTypes } from './includeFilterParser.js';
import { createFilterBuilderRow, entriesToFilterBuilderRows } from './filterBuilder.js';

export const WORKSPACE_SCHEMA = 'cxascode-exportbuilder';
export const WORKSPACE_VERSION = 1;

function getKnownSelectedResources(values, knownResourceSet) {
  return [...new Set(values)].filter(resource => knownResourceSet.has(resource)).sort();
}

function isNamedFilterEntry(entry) {
  return /::\^/.test(String(entry || ''));
}

function isBareResourceType(entry, knownResourceSet) {
  const trimmed = String(entry || '').trim();
  return knownResourceSet.has(trimmed) && !trimmed.includes('::');
}

function getImportedFilterEntries(exportItem, knownResourceSet) {
  const includeFilterResources = Array.isArray(exportItem.includeFilterResources)
    ? exportItem.includeFilterResources.filter(Boolean)
    : [];

  if (includeFilterResources.length > 0) {
    return includeFilterResources;
  }

  return getKnownSelectedResources(
    Array.isArray(exportItem.selectedResources) ? exportItem.selectedResources : [],
    knownResourceSet,
  );
}

function buildImportedExportState(exportItem, knownResourceSet, createId) {
  const filterEntries = getImportedFilterEntries(exportItem, knownResourceSet);

  const base = {
    id: createId(),
    name: String(exportItem.name || ''),
    pastedIncludeFilterResources: '',
    filterBuilderRows: [createFilterBuilderRow()],
  };

  if (filterEntries.some(isNamedFilterEntry)) {
    return {
      ...base,
      mode: 'builder',
      selectedResources: [],
      filterBuilderRows: entriesToFilterBuilderRows(filterEntries),
    };
  }

  const nonBareEntries = filterEntries.filter(entry => !isBareResourceType(entry, knownResourceSet));

  if (nonBareEntries.length > 0) {
    return {
      ...base,
      mode: 'paste',
      selectedResources: [],
      pastedIncludeFilterResources: filterEntries.join('\n'),
    };
  }

  return {
    ...base,
    mode: 'catalog',
    selectedResources: getKnownSelectedResources(
      filterEntries.map(extractResourceType).filter(type => knownResourceSet.has(type)),
      knownResourceSet,
    ),
  };
}

function getExportedSelectedResources(exportItem, generatedExport) {
  if (exportItem.mode === 'paste') {
    const parsed = parsePastedResourceTypes(exportItem.pastedIncludeFilterResources || '');
    if (parsed.length > 0) return parsed;
  }

  if (Array.isArray(exportItem.selectedResources) && exportItem.selectedResources.length > 0) {
    return exportItem.selectedResources;
  }

  return generatedExport?.includeFilterResources || [];
}

export function buildWorkspace({ exports: exportItems, model }) {
  return {
    schema: WORKSPACE_SCHEMA,
    version: WORKSPACE_VERSION,
    exportedAt: new Date().toISOString(),
    exports: exportItems.map(exportItem => {
      const generatedExport = model?.exports?.find(item => item.name === exportItem.name);
      const selectedResources = getExportedSelectedResources(exportItem, generatedExport);

      return {
        name: exportItem.name,
        tfExportResourceName: generatedExport?.tfExportResourceName || getTfExportResourceName(exportItem.name),
        selectedResources,
        firstLevelDependencies: generatedExport?.firstLevelDependencies || [],
        includeFilterResources: generatedExport?.includeFilterResources || [],
        replaceWithDatasource: generatedExport?.replaceWithDatasource || [],
      };
    }),
  };
}

export function downloadJsonFile({ filename, data }) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
}

export function parseWorkspace({ rawText, knownResources, sanitizeExportName, createId }) {
  const workspace = JSON.parse(rawText || '{}');

  const workspaceExports = workspace.exports ?? workspace.bundles;

  if (workspace.schema !== WORKSPACE_SCHEMA || !Array.isArray(workspaceExports)) {
    throw new Error('INVALID_WORKSPACE');
  }

  const knownResourceSet = new Set(knownResources);
  const seenNames = new Set();

  const exports = workspaceExports
    .map(exportItem => {
      const imported = buildImportedExportState(exportItem, knownResourceSet, createId);

      return {
        ...imported,
        name: sanitizeExportName(imported.name),
      };
    })
    .filter(exportItem => {
      if (!exportItem.name || seenNames.has(exportItem.name)) return false;
      seenNames.add(exportItem.name);
      return true;
    });

  return { exports };
}
