import { useEffect, useMemo, useRef, useState } from 'react';
import FilterResourceTypeInput from './components/FilterResourceTypeInput.jsx';
import { Pencil, Trash2 } from 'lucide-react';
import resources from './data/resources.json';
import { buildFallbackCatalog, parseResourceCatalog } from './lib/resourceCatalog.js';
import { buildExportModel } from './lib/exportModel.js';
import {
  getAssignedResources,
  getAvailableExportResources,
  getExportResources,
  getExportStats,
  sanitizeExportName,
  CORE_EXPORT_NAME,
  getTfExportDirectory,
  validateExports,
} from './lib/resourceModel.js';
import { buildWorkspace, downloadJsonFile, parseWorkspace } from './lib/workspace.js';
import { getExportResourceCount, parseIncludeFilterResourcesText, parsePastedResourceTypes } from './lib/includeFilterParser.js';
import {
  createFilterBuilderRow,
  entriesToFilterBuilderRows,
  filterBuilderRowsToEntries,
  getFilterBuilderRowCount,
  getFilterBuilderRows,
} from './lib/filterBuilder.js';
import {
  clearPermalinkResource,
  readPermalinkResource,
  setPermalinkResource,
} from './lib/permalink.js';
import { applyPageSeo } from './pageSeo.js';
import {
  buildDependencyTreeUrl,
  buildDependencyTreeVersionOptionsFromIndex,
  cacheDependencyTreeVersionOptions,
  DEPENDENCY_TREE_INDEX_URL,
  getCachedDependencyTreeVersionOptions,
  getDependencyTreeVersionLabel,
  getNewestListedRelease,
  LATEST_DEPENDENCY_TREE_VERSION,
} from './lib/dependencyTreeVersions.js';

const BUNDLED_RESOURCE_CATALOG = buildFallbackCatalog(resources);
const HOME_URL = 'https://cxascode.github.io/';

const TF_EXPORT_MODE_EXPORT = 'export';
const TF_EXPORT_MODE_EXPORT_STATE = 'exportstate';

function escapeHclString(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
}

function formatTerraformResourceList(values) {
  return values.map(value => `    "${escapeHclString(value)}"`).join(',\n');
}

function buildTfExportTemplate(exportItem, mode = TF_EXPORT_MODE_EXPORT) {
  const includeFilterResources = exportItem?.includeFilterResources || [];
  const replaceWithDatasource = exportItem?.replaceWithDatasource || [];
  const tfExportResourceName = exportItem?.tfExportResourceName || 'tf_export';
  const isExportState = mode === TF_EXPORT_MODE_EXPORT_STATE;
  const directory = getTfExportDirectory(tfExportResourceName);

  const includeFilterBlock = includeFilterResources.length === 0
    ? '  include_filter_resources           = []\n'
    : `  include_filter_resources           = [
${formatTerraformResourceList(includeFilterResources)}
  ]
`;

  const replaceWithDatasourceBlock = isExportState || replaceWithDatasource.length === 0
    ? '  replace_with_datasource            = []\n'
    : `  replace_with_datasource            = [
${formatTerraformResourceList(replaceWithDatasource)}
  ]
`;

  const legacyArchitectFlowExporterLine = isExportState
    ? '  use_legacy_architect_flow_exporter = true\n'
    : '  use_legacy_architect_flow_exporter = false\n';

  return `resource "genesyscloud_tf_export" "${tfExportResourceName}" {
  directory                          = "${directory}"
  enable_dependency_resolution       = ${isExportState ? 'false' : 'true'}
  export_format                      = "hcl"
  exclude_attributes                 = []
  include_state_file                 = ${isExportState ? 'true' : 'false'}
${includeFilterBlock}  log_permission_errors              = true
${replaceWithDatasourceBlock}  split_files_by_resource            = true
${legacyArchitectFlowExporterLine}}`;
}

function buildDefaultExport(prefillResource = null) {
  const normalizedResource = String(prefillResource || '').trim();

  return {
    id: crypto.randomUUID(),
    name: CORE_EXPORT_NAME,
    mode: 'catalog',
    selectedResources: normalizedResource ? [normalizedResource] : [],
    pastedIncludeFilterResources: '',
    filterBuilderRows: [createFilterBuilderRow()],
  };
}

export default function App() {
  const initialState = useMemo(() => {
    const exportItem = buildDefaultExport(readPermalinkResource());
    return { exports: [exportItem], selectedExportId: exportItem.id };
  }, []);
  const [resourceCatalog, setResourceCatalog] = useState(BUNDLED_RESOURCE_CATALOG);
  const [selectedCatalogVersion, setSelectedCatalogVersion] = useState(LATEST_DEPENDENCY_TREE_VERSION);
  const [catalogVersionOptions, setCatalogVersionOptions] = useState(() => getCachedDependencyTreeVersionOptions() || [LATEST_DEPENDENCY_TREE_VERSION]);
  const [exports, setExports] = useState(initialState.exports);
  const [selectedExportId, setSelectedExportId] = useState(initialState.selectedExportId);
  const [newExportName, setNewExportName] = useState('');
  const [isAddingExport, setIsAddingExport] = useState(false);
  const [renamingExportId, setRenamingExportId] = useState(null);
  const [renameExportName, setRenameExportName] = useState('');
  const [resourceDialogType, setResourceDialogType] = useState(null);
  const [query, setQuery] = useState('');
  const [selectedQuery, setSelectedQuery] = useState('');
  const [copyState, setCopyState] = useState('idle');
  const [tfExportMode, setTfExportMode] = useState(TF_EXPORT_MODE_EXPORT);
  const importRef = useRef(null);
  const versionDropdownRef = useRef(null);
  const selectedCatalogVersionRef = useRef(selectedCatalogVersion);
  const allResources = resourceCatalog.resourceTypes;

  useEffect(() => {
    selectedCatalogVersionRef.current = selectedCatalogVersion;
  }, [selectedCatalogVersion]);

  useEffect(() => {
    const defaultExport = exports.find(exportItem => exportItem.name === CORE_EXPORT_NAME);

    if (!defaultExport || defaultExport.mode === 'paste' || defaultExport.mode === 'builder') {
      clearPermalinkResource();
      return;
    }

    const selected = getExportResources(defaultExport);

    if (selected.length === 1) {
      setPermalinkResource(selected[0]);
      return;
    }

    clearPermalinkResource();
  }, [exports]);

  useEffect(() => {
    applyPageSeo(readPermalinkResource());
  }, [exports]);

  useEffect(() => {
    const onPopState = () => {
      applyPageSeo(readPermalinkResource());
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const el = versionDropdownRef.current;
    if (!el) return;

    const handler = (event) => {
      const next = event?.target?.value ?? event?.detail?.value ?? '';
      const normalizedNext = next || LATEST_DEPENDENCY_TREE_VERSION;

      if (normalizedNext === selectedCatalogVersionRef.current) return;
      setSelectedCatalogVersion(normalizedNext);
    };

    el.addEventListener('guxchange', handler);
    el.addEventListener('change', handler);

    return () => {
      el.removeEventListener('guxchange', handler);
      el.removeEventListener('change', handler);
    };
  }, []);

  useEffect(() => {
    const el = versionDropdownRef.current;
    if (!el) return;

    if (el.value !== selectedCatalogVersion) {
      el.value = selectedCatalogVersion;
    }

    el.setAttribute('value', selectedCatalogVersion);
  }, [selectedCatalogVersion, catalogVersionOptions]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCatalogVersions() {
      const cachedOptions = getCachedDependencyTreeVersionOptions();
      if (cachedOptions) return;

      try {
        const response = await fetch(DEPENDENCY_TREE_INDEX_URL, {
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Dependency catalog index request failed: ${response.status}`);
        }

        const options = buildDependencyTreeVersionOptionsFromIndex(await response.json());
        setCatalogVersionOptions(cacheDependencyTreeVersionOptions(options));
      } catch (error) {
        if (error.name === 'AbortError') return;
      }
    }

    loadCatalogVersions();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadResourceCatalog() {
      try {
        const response = await fetch(buildDependencyTreeUrl(selectedCatalogVersion), {
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Resource catalog request failed: ${response.status}`);
        }

        const catalog = parseResourceCatalog(await response.json());

        if (catalog.resourceTypes.length === 0) {
          throw new Error('Resource catalog did not contain any resource types.');
        }

        const knownResourceSet = new Set(catalog.resourceTypes);

        setResourceCatalog(catalog);
        setExports(current => current.map(exportItem => ({
          ...exportItem,
          selectedResources: getExportResources(exportItem).filter(resource => knownResourceSet.has(resource)),
        })));
      } catch (error) {
        if (error.name === 'AbortError') return;
        setResourceCatalog(BUNDLED_RESOURCE_CATALOG);
      }
    }

    loadResourceCatalog();

    return () => controller.abort();
  }, [selectedCatalogVersion]);

  const selectedExport = exports.find(exportItem => exportItem.id === selectedExportId) || exports[0] || buildDefaultExport();
  const selectedExportMode = selectedExport.mode === 'paste'
    ? 'paste'
    : selectedExport.mode === 'builder'
      ? 'builder'
      : 'catalog';
  const catalogExports = useMemo(
    () => exports.filter(exportItem => exportItem.mode === 'catalog'),
    [exports],
  );
  const newestListedRelease = useMemo(
    () => getNewestListedRelease(catalogVersionOptions),
    [catalogVersionOptions],
  );
  const selectedExportResources = getExportResources(selectedExport);
  const filteredSelectedExportResources = selectedExportResources.filter(resource => resource.includes(selectedQuery));
  const selectedResources = useMemo(() => [...new Set(catalogExports.flatMap(exportItem => getExportResources(exportItem)))].sort(), [catalogExports]);
  const assigned = useMemo(() => getAssignedResources(catalogExports), [catalogExports]);
  const parsedPasteResourceTypes = useMemo(() => {
    return parsePastedResourceTypes(selectedExport.pastedIncludeFilterResources);
  }, [selectedExport.pastedIncludeFilterResources]);

  const filterBuilderRows = useMemo(() => {
    if (selectedExport.mode !== 'builder') return [];
    return getFilterBuilderRows(selectedExport);
  }, [selectedExport]);

  const builderFilterEntries = useMemo(() => {
    return filterBuilderRowsToEntries(filterBuilderRows);
  }, [filterBuilderRows]);

  const builderRowCount = useMemo(() => {
    return getFilterBuilderRowCount(filterBuilderRows);
  }, [filterBuilderRows]);

  const unassignedResources = useMemo(() => {
    return getAvailableExportResources({
      resources: allResources,
      assigned,
      query: '',
    });
  }, [assigned, allResources]);

  const availableResources = useMemo(() => {
    const selectedSet = new Set(selectedExportResources);

    return getAvailableExportResources({
      resources: allResources,
      assigned,
      query,
    }).filter(resource => !selectedSet.has(resource));
  }, [assigned, query, allResources, selectedExportResources]);

  const stats = useMemo(() => {
    const catalogStats = getExportStats({
      resources: allResources,
      exports: catalogExports,
      assigned,
    });
    const nonCatalogSelectedCount = exports
      .filter(exportItem => exportItem.mode === 'paste' || exportItem.mode === 'builder')
      .reduce((total, exportItem) => total + getExportResourceCount(exportItem), 0);

    return {
      ...catalogStats,
      selectedResourceCount: catalogStats.selectedResourceCount + nonCatalogSelectedCount,
    };
  }, [assigned, exports, catalogExports, allResources]);

  const validation = useMemo(() => {
    return validateExports({ exports: catalogExports });
  }, [catalogExports, allResources]);

  const resourceDialog = useMemo(() => {
    if (resourceDialogType === 'known') {
      return {
        title: 'Known resources',
        description: 'All resource types loaded from the current dependency catalog.',
        resources: allResources,
      };
    }

    if (resourceDialogType === 'selected') {
      return {
        title: 'Selected resources',
        description: 'Resource types currently assigned across all exports.',
        resources: selectedResources,
      };
    }

    if (resourceDialogType === 'available') {
      return {
        title: 'Available resources',
        description: 'Resource types not assigned to any export.',
        resources: unassignedResources,
      };
    }

    return null;
  }, [allResources, resourceDialogType, selectedResources, unassignedResources]);

  const model = useMemo(() => {
    return buildExportModel({
      dependencyMap: resourceCatalog.dependencyMap,
      exports,
      stats,
      validation,
    });
  }, [exports, stats, validation, resourceCatalog.dependencyMap]);

  const selectedGeneratedExport = useMemo(() => {
    return model.exports.find(item => item.name === selectedExport.name) || model.exports[0] || null;
  }, [model.exports, selectedExport.name]);

  const mainTfTemplate = useMemo(() => {
    return model.exports
      .map(exportItem => buildTfExportTemplate(exportItem, tfExportMode))
      .filter(Boolean)
      .join('\n\n');
  }, [model.exports, tfExportMode]);

  function startAddingExport() {
    cancelRenamingExport();
    setNewExportName('');
    setQuery('');
    setIsAddingExport(true);
  }

  function cancelAddingExport() {
    setNewExportName('');
    setIsAddingExport(false);
  }

  function startRenamingExport(exportItem) {
    setIsAddingExport(false);
    setRenamingExportId(exportItem.id);
    setRenameExportName(exportItem.name);
  }

  function cancelRenamingExport() {
    setRenamingExportId(null);
    setRenameExportName('');
  }

  function saveRenamedExport() {
    if (!renamingExportId) return;

    const name = sanitizeExportName(renameExportName);

    if (!name || exports.some(exportItem => exportItem.id !== renamingExportId && exportItem.name === name)) return;

    setExports(current => current.map(exportItem => (
      exportItem.id === renamingExportId ? { ...exportItem, name } : exportItem
    )));
    cancelRenamingExport();
  }

  function addExport() {
    const name = sanitizeExportName(newExportName);

    if (!name || exports.some(exportItem => exportItem.name === name)) return;

    const exportItem = buildDefaultExport();
    exportItem.name = name;

    setExports(current => [...current, exportItem]);
    setSelectedExportId(exportItem.id);
    setNewExportName('');
    setQuery('');
    setIsAddingExport(false);
  }

  function deleteExport(id) {
    setExports(current => {
      if (current.length <= 1) return current;

      const next = current.filter(exportItem => exportItem.id !== id);

      setSelectedExportId(next[0]?.id || null);
      setQuery('');
      return next;
    });
  }

  function setSelectedExportMode(mode) {
    if (!selectedExportId) return;

    setExports(current => current.map(exportItem => {
      if (exportItem.id !== selectedExportId) return exportItem;

      if (mode === 'paste' && exportItem.mode !== 'paste') {
        const pasted = String(exportItem.pastedIncludeFilterResources || '').trim();
        const seededPaste = pasted
          || (exportItem.mode === 'builder'
            ? filterBuilderRowsToEntries(exportItem.filterBuilderRows).join('\n')
            : getExportResources(exportItem).join('\n'));

        return { ...exportItem, mode, pastedIncludeFilterResources: seededPaste };
      }

      if (mode === 'builder') {
        const existingRows = getFilterBuilderRows(exportItem);
        const seededRows = getFilterBuilderRowCount(existingRows) > 0
          ? existingRows
          : entriesToFilterBuilderRows(
            exportItem.mode === 'paste'
              ? parseIncludeFilterResourcesText(exportItem.pastedIncludeFilterResources)
              : getExportResources(exportItem),
          );

        return { ...exportItem, mode: 'builder', filterBuilderRows: seededRows };
      }

      if (mode === 'catalog' && exportItem.mode !== 'catalog') {
        const knownResourceSet = new Set(allResources);
        const seededSelected = exportItem.mode === 'paste'
          ? (getExportResources(exportItem).length > 0
            ? getExportResources(exportItem)
            : parsePastedResourceTypes(exportItem.pastedIncludeFilterResources)
              .filter(resource => knownResourceSet.has(resource)))
          : [...new Set(
            filterBuilderRowsToEntries(exportItem.filterBuilderRows)
              .map(entry => entry.split('::')[0])
              .filter(resource => knownResourceSet.has(resource)),
          )].sort();

        return { ...exportItem, mode, selectedResources: seededSelected };
      }

      return { ...exportItem, mode };
    }));
  }

  function updateFilterBuilderRow(rowId, field, value) {
    if (!selectedExportId) return;

    setExports(current => current.map(exportItem => {
      if (exportItem.id !== selectedExportId) return exportItem;

      const rows = getFilterBuilderRows(exportItem);

      return {
        ...exportItem,
        mode: 'builder',
        filterBuilderRows: rows.map(row => (
          row.id === rowId ? { ...row, [field]: value } : row
        )),
      };
    }));
  }

  function addFilterBuilderRow() {
    if (!selectedExportId) return;

    setExports(current => current.map(exportItem => {
      if (exportItem.id !== selectedExportId) return exportItem;

      const rows = getFilterBuilderRows(exportItem);

      return {
        ...exportItem,
        mode: 'builder',
        filterBuilderRows: [...rows, createFilterBuilderRow()],
      };
    }));
  }

  function removeFilterBuilderRow(rowId) {
    if (!selectedExportId) return;

    setExports(current => current.map(exportItem => {
      if (exportItem.id !== selectedExportId) return exportItem;

      const rows = getFilterBuilderRows(exportItem);
      const nextRows = rows.filter(row => row.id !== rowId);

      return {
        ...exportItem,
        mode: 'builder',
        filterBuilderRows: nextRows.length > 0 ? nextRows : [createFilterBuilderRow()],
      };
    }));
  }

  function updatePastedIncludeFilters(value) {
    if (!selectedExportId) return;

    setExports(current => current.map(exportItem => {
      return exportItem.id === selectedExportId
        ? { ...exportItem, mode: 'paste', pastedIncludeFilterResources: value }
        : exportItem;
    }));
  }

  function moveToExport(resource, exportId = selectedExportId) {
    if (!exportId) return;

    setExports(current => current.map(exportItem => {
      const withoutResource = getExportResources(exportItem).filter(item => item !== resource);

      if (exportItem.id === exportId) {
        return { ...exportItem, selectedResources: [...withoutResource, resource].sort() };
      }

      return { ...exportItem, selectedResources: withoutResource };
    }));
  }

  function removeFromExport(resource, exportId) {
    setExports(current => current.map(exportItem => {
      return exportItem.id === exportId
        ? { ...exportItem, selectedResources: getExportResources(exportItem).filter(item => item !== resource) }
        : exportItem;
    }));
  }

  function reset() {
    const defaultExport = buildDefaultExport();
    setExports([defaultExport]);
    setSelectedExportId(defaultExport.id);
    setNewExportName('');
    setIsAddingExport(false);
    cancelRenamingExport();
    setResourceDialogType(null);
    setQuery('');
  }

  function downloadWorkspace() {
    if (exports.length === 0) return;

    downloadJsonFile({
      filename: 'exportbuilder-workspace.json',
      data: buildWorkspace({ exports, model }),
    });
  }

  function importWorkspaceFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const workspace = parseWorkspace({
          rawText: String(reader.result || '{}'),
          knownResources: allResources,
          sanitizeExportName,
          createId: () => crypto.randomUUID(),
        });

        setExports(workspace.exports.length > 0 ? workspace.exports : [buildDefaultExport()]);
        setSelectedExportId(workspace.exports[0]?.id || null);
        setNewExportName('');
        setIsAddingExport(false);
        setResourceDialogType(null);
        setQuery('');
      } catch {
        window.alert('Unable to read that workspace file. Make sure it is a valid Export Builder workspace JSON file.');
      }
    };

    reader.readAsText(file);
  }

  async function copyGeneratedOutput(value) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1500);
    } catch {
      setCopyState('failed');
      window.setTimeout(() => setCopyState('idle'), 1500);
    }
  }

  return <div className="gcShell">
    <header className="gcPageHeader">
      <div className="gcPageTitleRow">
        <div className="gcPageTitleGroup">
          <h1 className="gcPageTitle">
            <a className="gcSiteHomeLink" href={HOME_URL}>Home</a>
            <span className="gcPageTitleSeparator" aria-hidden="true">/</span>
            <span className="gcPageTitleCurrent">CX as Code Export Builder</span>
          </h1>
        </div>
        <div className="gcPageMeta">
          <div className="gcHeaderLinks">
            <input ref={importRef} type="file" accept="application/json,.json" onChange={importWorkspaceFile} hidden />
            <button type="button" className="gcHeaderLink" onClick={() => importRef.current?.click()}>Import</button>
            <button type="button" className="gcHeaderLink" onClick={downloadWorkspace} disabled={exports.length === 0} title={exports.length === 0 ? 'Create an export before saving a workspace.' : 'Export workspace JSON'}>Export</button>
            <button type="button" className="gcClearButton" onClick={reset}>Reset</button>
          </div>
          <div className="gcVersionPicker">
            <span className="gcMetaLabel">Version:</span>
            <gux-dropdown ref={versionDropdownRef} value={selectedCatalogVersion}>
              <gux-listbox>
                {catalogVersionOptions.map(version => (
                  <gux-option key={version} value={version}>{getDependencyTreeVersionLabel(version, newestListedRelease)}</gux-option>
                ))}
              </gux-listbox>
            </gux-dropdown>
          </div>
        </div>
      </div>
    </header>

    <main className="gcContentArea">
      <div className="stats-grid">
        <button type="button" className="stat-card mini-stat stat-button" onClick={() => setResourceDialogType('known')}>
          <div className="mini-stat-heading"><p className="eyebrow">Known</p><strong>{stats.knownResourceCount}</strong></div>
          <span>Resource types</span>
        </button>
        <button type="button" className="stat-card mini-stat stat-button" onClick={() => setResourceDialogType('selected')}>
          <div className="mini-stat-heading"><p className="eyebrow">Selected</p><strong>{stats.selectedResourceCount}</strong></div>
          <span>Across exports</span>
        </button>
        <button type="button" className="stat-card mini-stat stat-button" onClick={() => setResourceDialogType('available')}>
          <div className="mini-stat-heading"><p className="eyebrow">Available</p><strong>{stats.availableResourceCount}</strong></div>
          <span>Unassigned</span>
        </button>
      </div>

      <section className="gcCard export-nav">
        <div className="section-title">
          <div><h2>Exports</h2><p>Select an export to build its Terraform template.</p></div>
          <div className="export-nav-actions">
            {!isAddingExport && <button type="button" className="gcHeaderLink" onClick={startAddingExport}>Add export</button>}
          </div>
        </div>
        {isAddingExport && <div className="field add-export-form">
          <label htmlFor="new-export-name">Add export</label>
          <div className="inline">
              <input id="new-export-name" value={newExportName} onChange={event => setNewExportName(event.target.value)} placeholder="letters, numbers, _, and -" />
            <button type="button" className="gcHeaderLink" onClick={addExport}>Save</button>
            <button type="button" className="gcClearButton" onClick={cancelAddingExport}>Cancel</button>
          </div>
        </div>}
        <div className="export-list">
          {exports.map(exportItem => {
            if (renamingExportId === exportItem.id) {
              return <div key={exportItem.id} className="field add-export-form export-rename-form">
                <label htmlFor={`rename-export-${exportItem.id}`}>Rename export</label>
                <div className="inline">
                  <input
                    id={`rename-export-${exportItem.id}`}
                    value={renameExportName}
                    onChange={event => setRenameExportName(event.target.value)}
                    placeholder="letters, numbers, _, and -"
                  />
                  <button type="button" className="gcHeaderLink" onClick={saveRenamedExport}>Save</button>
                  <button type="button" className="gcClearButton" onClick={cancelRenamingExport}>Cancel</button>
                </div>
              </div>;
            }

            return <button
              type="button"
              key={exportItem.id}
              className={exportItem.id === selectedExportId ? 'export selected' : 'export'}
              onClick={() => {
                cancelRenamingExport();
                setSelectedExportId(exportItem.id);
                setQuery('');
                setSelectedQuery('');
              }}
            >
              <span>
                <strong>{exportItem.name}</strong>
                <small>{getExportResourceCount(exportItem)} {exportItem.mode === 'paste' ? 'pasted' : exportItem.mode === 'builder' ? 'filtered' : 'selected'}</small>
              </span>
              <div className="export-actions">
                <button
                  type="button"
                  className="export-action"
                  title="Rename export"
                  aria-label="Rename export"
                  onClick={event => { event.stopPropagation(); startRenamingExport(exportItem); }}
                >
                  <Pencil size={14} aria-hidden="true" />
                </button>
                {exports.length > 1 && (
                  <button
                    type="button"
                    className="export-action export-action--destructive"
                    title="Remove export"
                    aria-label="Remove export"
                    onClick={event => { event.stopPropagation(); deleteExport(exportItem.id); }}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
            </button>;
          })}
        </div>
      </section>

    {resourceDialog && <div className="dialog-backdrop" role="presentation" onClick={() => setResourceDialogType(null)}>
        <section className="gcCard resource-dialog" role="dialog" aria-modal="true" aria-labelledby="resource-dialog-title" onClick={event => event.stopPropagation()}>
          <div className="section-title">
            <div><h2 id="resource-dialog-title">{resourceDialog.title}</h2><p>{resourceDialog.description}</p></div>
            <button type="button" className="gcClearButton" onClick={() => setResourceDialogType(null)}>Close</button>
          </div>
          <div className="chips scroll short">
            {resourceDialog.resources.map(resource => <span className="chip" key={resource}>{resource}</span>)}
          </div>
        </section>
      </div>}

      <div className="grid">
        <section className="gcCard input-panel">
          <div className="section-title">
            <div>
              <h2>Available resources</h2>
              <p>
                {selectedExportMode === 'catalog'
                  ? 'Add resource types to export. First-level dependencies are suggested for replace_with_datasource.'
                  : selectedExportMode === 'builder'
                    ? 'Pick a resource type and name to build named include filters. Special regex characters are escaped automatically.'
                    : <>Paste filter entries one per line. Named patterns like <code>::^Name$</code> are preserved in output.</>}
              </p>
            </div>
            <gux-badge>{selectedExportMode === 'catalog' ? availableResources.length : selectedExportMode === 'builder' ? builderRowCount : parsedPasteResourceTypes.length}</gux-badge>
          </div>

          <div className="input-toolbar">
            <div className="gcSegmentedControl gcSegmentedControl--text" role="group" aria-label="Input mode">
              <button
                type="button"
                className="gcSegmentedControl__option"
                aria-checked={selectedExportMode === 'catalog'}
                onClick={() => setSelectedExportMode('catalog')}
              >
                Catalog
              </button>
              <button
                type="button"
                className="gcSegmentedControl__option"
                aria-checked={selectedExportMode === 'builder'}
                onClick={() => setSelectedExportMode('builder')}
              >
                Filter
              </button>
              <button
                type="button"
                className="gcSegmentedControl__option"
                aria-checked={selectedExportMode === 'paste'}
                onClick={() => setSelectedExportMode('paste')}
              >
                Paste
              </button>
            </div>
            {selectedExportMode === 'catalog' && <div className="search">
              <input
                type="search"
                className="gcSearchInput"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="filter e.g. flow, routing, outbound"
              />
              {query && <button type="button" className="search-clear" onClick={() => setQuery('')}>clear</button>}
            </div>}
          </div>

          {selectedExportMode === 'catalog' ? <>
          <div className="resource-list">
            {availableResources.map(resource => <div className="resource" key={resource}>
              <code>{resource}</code>
              <button type="button" className="gcHeaderLink" onClick={() => moveToExport(resource)} title={`Add to ${selectedExport.name}`}>add</button>
            </div>)}
            {availableResources.length === 0 && <p className="empty">No available resources match that filter.</p>}
          </div>
          </> : selectedExportMode === 'builder' ? <>
          <div className="filter-builder-table-wrap">
            <table className="filter-builder-table">
              <thead>
                <tr>
                  <th>Resource type</th>
                  <th>Name / label</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filterBuilderRows.map(row => (
                  <tr key={row.id}>
                    <td className="filter-builder-type-cell">
                      <FilterResourceTypeInput
                        value={row.resourceType}
                        resources={allResources}
                        onChange={next => updateFilterBuilderRow(row.id, 'resourceType', next)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="filter-builder-input"
                        value={row.name}
                        onChange={event => updateFilterBuilderRow(row.id, 'name', event.target.value)}
                        placeholder="Resource name in Genesys Cloud"
                        autoComplete="off"
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="export-action export-action--destructive"
                        title="Remove row"
                        aria-label="Remove row"
                        onClick={() => removeFilterBuilderRow(row.id)}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="filter-builder-actions">
            <button type="button" className="gcHeaderLink" onClick={addFilterBuilderRow}>Add row</button>
          </div>
          {builderFilterEntries.length > 0 && <div className="paste-preview">
            <p className="eyebrow">Generated filters</p>
            <div className="chips scroll short">
              {builderFilterEntries.map(entry => <span className="chip chip--mono" key={entry}>{entry}</span>)}
            </div>
          </div>}
          {selectedGeneratedExport?.firstLevelDependencies?.length > 0 && <div className="dependency-preview">
            <p className="eyebrow">First-level dependencies</p>
            <div className="chips scroll short">
              {selectedGeneratedExport.firstLevelDependencies.map(resource => <span className="chip" key={resource}>{resource}</span>)}
            </div>
          </div>}
          </> : <>
          <textarea
            className="paste-input"
            value={selectedExport.pastedIncludeFilterResources || ''}
            onChange={event => updatePastedIncludeFilters(event.target.value)}
            placeholder={`genesyscloud_routing_queue\ngenesyscloud_architect_schedules\ngenesyscloud_flow`}
            spellCheck={false}
          />
          {parsedPasteResourceTypes.length > 0 && <div className="paste-preview">
            <p className="eyebrow">Resource types</p>
            <div className="chips scroll short">
              {parsedPasteResourceTypes.map(resource => <span className="chip" key={resource}>{resource}</span>)}
            </div>
          </div>}
          {selectedGeneratedExport?.firstLevelDependencies?.length > 0 && <div className="dependency-preview">
            <p className="eyebrow">First-level dependencies</p>
            <div className="chips scroll short">
              {selectedGeneratedExport.firstLevelDependencies.map(resource => <span className="chip" key={resource}>{resource}</span>)}
            </div>
          </div>}
          </>}
        </section>

        {selectedExportMode === 'catalog' ? <>
        <section className="gcCard selected-panel">
          <div className="section-title">
            <div><h2>{selectedExport.name}</h2><p>Primary resource types for this export. First-level dependencies drive <code>replace_with_datasource</code>.</p></div>
            <gux-badge>{selectedExportResources.length}</gux-badge>
          </div>
          <div className="search">
            <input
              type="search"
              className="gcSearchInput"
              value={selectedQuery}
              onChange={event => setSelectedQuery(event.target.value)}
              placeholder="filter selected resources"
            />
            {selectedQuery && <button type="button" className="search-clear" onClick={() => setSelectedQuery('')}>clear</button>}
          </div>
          <div className="resource-list">
            {filteredSelectedExportResources.map(resource => <div className="resource" key={resource}>
              <code>{resource}</code>
              <div className="actions">
                <button type="button" className="gcClearButton destructive" onClick={() => removeFromExport(resource, selectedExport.id)}>remove</button>
              </div>
            </div>)}
            {filteredSelectedExportResources.length === 0 && <p className="empty">No selected resources match that filter.</p>}
          </div>
        </section>
        </> : null}

        <section className={selectedExportMode === 'paste' || selectedExportMode === 'builder' ? 'gcCard output output-panel--paste' : 'gcCard output'}>
          <div className="section-title">
            <div>
              <h2>Generated export</h2>
              <p>
                {tfExportMode === TF_EXPORT_MODE_EXPORT_STATE
                  ? 'Generate a Terraform state file for existing resources — brownfield adoption and import workflows.'
                  : 'Generate HCL configuration with dependency types exported as data sources.'}
              </p>
            </div>
          </div>

          <div className="generated-file">
            <div className="generated-file-header">
              <div className="generated-file-header__start">
                <h3>main.tf</h3>
                <div
                  className="gcSegmentedControl gcSegmentedControl--text"
                  role="radiogroup"
                  aria-label="Export template mode"
                >
                  <button
                    type="button"
                    className="gcSegmentedControl__option"
                    role="radio"
                    aria-checked={tfExportMode === TF_EXPORT_MODE_EXPORT}
                    onClick={() => setTfExportMode(TF_EXPORT_MODE_EXPORT)}
                  >
                    Export
                  </button>
                  <button
                    type="button"
                    className="gcSegmentedControl__option"
                    role="radio"
                    aria-checked={tfExportMode === TF_EXPORT_MODE_EXPORT_STATE}
                    onClick={() => setTfExportMode(TF_EXPORT_MODE_EXPORT_STATE)}
                  >
                    Export state
                  </button>
                </div>
              </div>
              <button
                type="button"
                className="gcCopyButton"
                onClick={() => copyGeneratedOutput(mainTfTemplate)}
                disabled={!mainTfTemplate}
              >
                {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy'}
              </button>
            </div>
            <pre>{mainTfTemplate}</pre>
          </div>
        </section>
      </div>
    </main>
  </div>;
}
