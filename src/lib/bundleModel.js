import { getFirstLevelDependencies, getBundleResources, getTfExportResourceName } from './resourceModel.js';
import { buildPasteModeModel, parseIncludeFilterResourcesText } from './includeFilterParser.js';

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function getReplaceWithDatasource(resources) {
  return uniqueSorted(resources).map(resource => `${resource}::.*`);
}

function buildCatalogBundleModel(bundle, dependencyMap) {
  const selectedResources = getBundleResources(bundle).sort();
  const firstLevelDependencies = getFirstLevelDependencies({
    selectedResources,
    dependencyMap,
  });
  const includeFilterResources = selectedResources;

  return {
    name: bundle.name,
    mode: 'catalog',
    tfExportResourceName: getTfExportResourceName(bundle.name),
    selectedResources,
    primaryResourceTypes: selectedResources,
    firstLevelDependencies,
    includeFilterResources,
    replaceWithDatasource: getReplaceWithDatasource(firstLevelDependencies),
  };
}

function buildPasteBundleModel(bundle, dependencyMap) {
  const filterEntries = parseIncludeFilterResourcesText(bundle.pastedIncludeFilterResources);
  const pasteModel = buildPasteModeModel({
    filterEntries,
    dependencyMap,
  });

  return {
    name: bundle.name,
    mode: 'paste',
    tfExportResourceName: getTfExportResourceName(bundle.name),
    selectedResources: pasteModel.primaryResourceTypes,
    primaryResourceTypes: pasteModel.primaryResourceTypes,
    firstLevelDependencies: pasteModel.firstLevelDependencies,
    includeFilterResources: pasteModel.includeFilterResources,
    replaceWithDatasource: pasteModel.replaceWithDatasource,
  };
}

export function buildBundleModel({
  dependencyMap = new Map(),
  bundles,
  stats,
  validation,
}) {
  const bundleModels = bundles.map(bundle => {
    if (bundle.mode === 'paste') {
      return buildPasteBundleModel(bundle, dependencyMap);
    }

    return buildCatalogBundleModel(bundle, dependencyMap);
  });

  return {
    summary: {
      knownResourceTypes: stats.knownResourceCount,
      selectedResources: stats.selectedResourceCount,
      availableResources: stats.availableResourceCount,
      bundleCount: bundles.length,
    },
    bundles: bundleModels,
    rawValidation: {
      ...validation,
      startup: bundles.length === 0,
    },
  };
}
