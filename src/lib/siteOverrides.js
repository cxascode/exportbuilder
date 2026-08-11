const DEFAULT_HIDDEN_RESOURCE_TYPES = [
  'genesyscloud_bcp_tf_exporter',
  'genesyscloud_tf_export',
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
  ];
}

export function getHiddenResourceTypes(overrides, fallbackTypes = DEFAULT_HIDDEN_RESOURCE_TYPES) {
  const hidden = normalizeTypeList(overrides?.hiddenResourceTypes);

  if (hidden.length > 0) {
    return new Set(hidden);
  }

  return new Set(normalizeTypeList(fallbackTypes));
}

export function normalizeSiteOverrides(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      hiddenResourceTypes: [],
      classificationExtras: null,
    };
  }

  return {
    hiddenResourceTypes: normalizeTypeList(value.hiddenResourceTypes),
    classificationExtras: value.classificationExtras && typeof value.classificationExtras === 'object'
      ? value.classificationExtras
      : null,
  };
}
