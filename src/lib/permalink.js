export const PERMALINK_RESOURCE_PARAM = 'resource';
const RESOURCE_TYPE_PATTERN = /^genesyscloud_[a-z0-9_]+$/;

function normalizeBasePath(baseUrl = import.meta.env.BASE_URL) {
  const base = String(baseUrl || '/');

  if (base === './') {
    return '/';
  }

  return base.endsWith('/') ? base : `${base}/`;
}

function getResourcePathSegment(pathname, basePath = import.meta.env.BASE_URL) {
  const normalizedBase = normalizeBasePath(basePath);
  let remainder = pathname || '/';

  if (normalizedBase !== '/' && remainder.startsWith(normalizedBase)) {
    remainder = remainder.slice(normalizedBase.length);
  } else if (normalizedBase === '/' && remainder.startsWith('/')) {
    remainder = remainder.slice(1);
  }

  const segments = remainder.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);

  if (segments.length !== 1) {
    return null;
  }

  const [segment] = segments;

  if (segment === 'assets') {
    return null;
  }

  const decoded = decodeURIComponent(segment);

  return RESOURCE_TYPE_PATTERN.test(decoded) ? decoded : null;
}

function buildResourcePathname(resource, basePath = import.meta.env.BASE_URL) {
  const normalizedBase = normalizeBasePath(basePath);
  const normalized = String(resource || '').trim();

  if (!normalized) {
    return normalizedBase === '/' ? '/' : normalizedBase.replace(/\/$/, '') || '/';
  }

  const encoded = encodeURIComponent(normalized);

  if (normalizedBase === '/') {
    return `/${encoded}`;
  }

  return `${normalizedBase}${encoded}`;
}

export function readPermalinkResource() {
  if (typeof window === 'undefined') return null;

  const fromPath = getResourcePathSegment(window.location.pathname);

  if (fromPath) {
    return fromPath;
  }

  const fromQuery = new URLSearchParams(window.location.search)
    .get(PERMALINK_RESOURCE_PARAM)
    ?.trim();

  return fromQuery || null;
}

export function setPermalinkResource(resource) {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  url.searchParams.delete(PERMALINK_RESOURCE_PARAM);
  url.pathname = buildResourcePathname(resource);
  url.hash = '';

  const nextUrl = url.toString();

  if (nextUrl !== window.location.href) {
    window.history.replaceState(null, '', url);
  }
}

export function clearPermalinkResource() {
  setPermalinkResource(null);
}

export function buildPermalinkUrl(resource, baseUrl = window.location.href) {
  const url = new URL(baseUrl);
  url.searchParams.delete(PERMALINK_RESOURCE_PARAM);
  url.pathname = buildResourcePathname(resource, import.meta.env.BASE_URL);
  url.hash = '';
  return url.toString();
}
