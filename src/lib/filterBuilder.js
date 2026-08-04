import { extractResourceType } from './includeFilterParser.js';

// Matches Go's regexp.QuoteMeta — RE2 metacharacters that must be escaped for literal name matches.
const GO_REGEX_METACHARACTERS = /[\\.+*?()|[\]{}^$]/g;

export function escapeGoRegexLiteral(value) {
  return String(value || '').replace(GO_REGEX_METACHARACTERS, '\\$&');
}

export function unescapeGoRegexLiteral(value) {
  return String(value || '').replace(/\\([\\.+*?()|[\]{}^$])/g, '$1');
}

export function createFilterBuilderRow(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    resourceType: '',
    name: '',
    ...overrides,
  };
}

export function buildNamedFilterEntry(resourceType, name) {
  const type = String(resourceType || '').trim();
  const label = String(name || '').trim();

  if (!type) return '';
  if (!label) return type;

  return `${type}::^${escapeGoRegexLiteral(label)}$`;
}

export function parseFilterEntryToRow(entry) {
  const raw = String(entry || '').trim();
  if (!raw) return createFilterBuilderRow();

  const namedMatch = raw.match(/^(.+?)::\^(.+)\$$/);
  if (namedMatch) {
    return createFilterBuilderRow({
      resourceType: namedMatch[1].trim(),
      name: unescapeGoRegexLiteral(namedMatch[2]),
    });
  }

  return createFilterBuilderRow({
    resourceType: extractResourceType(raw),
    name: '',
  });
}

export function filterBuilderRowsToEntries(rows) {
  return [...new Set(
    (rows || [])
      .map(row => buildNamedFilterEntry(row.resourceType, row.name))
      .filter(Boolean),
  )];
}

export function entriesToFilterBuilderRows(entries) {
  const rows = (entries || [])
    .map(parseFilterEntryToRow)
    .filter(row => row.resourceType);

  return rows.length > 0 ? rows : [createFilterBuilderRow()];
}

export function getFilterBuilderRows(exportItem) {
  if (Array.isArray(exportItem?.filterBuilderRows) && exportItem.filterBuilderRows.length > 0) {
    return exportItem.filterBuilderRows;
  }

  return [createFilterBuilderRow()];
}

export function getFilterBuilderRowCount(rows) {
  return (rows || []).filter(row => String(row.resourceType || '').trim()).length;
}
