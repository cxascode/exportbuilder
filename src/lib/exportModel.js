import { getFirstLevelDependencies, getExportResources, getTfExportResourceName } from './resourceModel.js';
import { buildPasteModeModel, parseIncludeFilterResourcesText } from './includeFilterParser.js';

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function getReplaceWithDatasource(resources) {
  return uniqueSorted(resources).map(resource => `${resource}::.*`);
}

function buildCatalogExportModel(exportItem, dependencyMap) {
  const selectedResources = getExportResources(exportItem).sort();
  const firstLevelDependencies = getFirstLevelDependencies({
    selectedResources,
    dependencyMap,
  });
  const includeFilterResources = selectedResources;

  return {
    name: exportItem.name,
    mode: 'catalog',
    tfExportResourceName: getTfExportResourceName(exportItem.name),
    selectedResources,
    primaryResourceTypes: selectedResources,
    firstLevelDependencies,
    includeFilterResources,
    replaceWithDatasource: getReplaceWithDatasource(firstLevelDependencies),
  };
}

function buildPasteExportModel(exportItem, dependencyMap) {
  const filterEntries = parseIncludeFilterResourcesText(exportItem.pastedIncludeFilterResources);
  const pasteModel = buildPasteModeModel({
    filterEntries,
    dependencyMap,
  });

  return {
    name: exportItem.name,
    mode: 'paste',
    tfExportResourceName: getTfExportResourceName(exportItem.name),
    selectedResources: pasteModel.primaryResourceTypes,
    primaryResourceTypes: pasteModel.primaryResourceTypes,
    firstLevelDependencies: pasteModel.firstLevelDependencies,
    includeFilterResources: pasteModel.includeFilterResources,
    replaceWithDatasource: pasteModel.replaceWithDatasource,
  };
}

export function buildExportModel({
  dependencyMap = new Map(),
  exports: exportItems,
  stats,
  validation,
}) {
  const exportModels = exportItems.map(exportItem => {
    if (exportItem.mode === 'paste') {
      return buildPasteExportModel(exportItem, dependencyMap);
    }

    return buildCatalogExportModel(exportItem, dependencyMap);
  });

  return {
    summary: {
      knownResourceTypes: stats.knownResourceCount,
      selectedResources: stats.selectedResourceCount,
      availableResources: stats.availableResourceCount,
      exportCount: exportItems.length,
    },
    exports: exportModels,
    rawValidation: {
      ...validation,
      startup: exportItems.length === 0,
    },
  };
}
