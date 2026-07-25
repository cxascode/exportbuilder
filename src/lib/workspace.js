import { getTfExportResourceName } from './resourceModel.js';
import { parsePastedResourceTypes } from './includeFilterParser.js';

export const WORKSPACE_SCHEMA = 'cxascode-exportbuilder';
export const WORKSPACE_VERSION = 1;

function getKnownSelectedResources(values, knownResourceSet) {
  return [...new Set(values)].filter(resource => knownResourceSet.has(resource)).sort();
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

function getImportedSelectedResources(exportItem, knownResourceSet) {
  return getKnownSelectedResources(
    Array.isArray(exportItem.selectedResources) ? exportItem.selectedResources : [],
    knownResourceSet,
  );
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
      const name = sanitizeExportName(String(exportItem.name || ''));

      return {
        id: createId(),
        name,
        mode: 'catalog',
        selectedResources: getImportedSelectedResources(exportItem, knownResourceSet),
        pastedIncludeFilterResources: '',
      };
    })
    .filter(exportItem => {
      if (!exportItem.name || seenNames.has(exportItem.name)) return false;
      seenNames.add(exportItem.name);
      return true;
    });

  return { exports };
}
