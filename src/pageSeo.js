import { buildResourcePathname } from './lib/permalink.js';

const PRODUCTION_ORIGIN = 'https://cxascode.github.io';

const DEFAULT_TITLE = 'CX as Code Export Builder';
const DEFAULT_DESCRIPTION =
  'Build genesyscloud_tf_export configurations for multiple Genesys Cloud Terraform resource types. Combine exports, paste include filters, and copy generated HCL for CX as Code workflows.';

function pageOrigin() {
  if (typeof window === 'undefined') return PRODUCTION_ORIGIN;
  return window.location.origin;
}

export function pageSeoForResource(resourceType) {
  const type = (resourceType || '').trim();

  if (type) {
    return {
      title: `${type} — CX as Code Export Builder`,
      description: `Build a genesyscloud_tf_export configuration starting with ${type}. Add more Genesys Cloud Terraform resource types and copy generated HCL for CX as Code.`,
      pathname: buildResourcePathname(type),
    };
  }

  return {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    pathname: buildResourcePathname(null),
  };
}

function upsertMetaByName(name, content) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertMetaByProperty(property, content) {
  let el = document.querySelector(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href) {
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.rel = 'canonical';
    document.head.appendChild(el);
  }
  el.href = href;
}

export function applyPageSeo(resourceType) {
  if (typeof document === 'undefined') return;

  const { title, description, pathname } = pageSeoForResource(resourceType);
  const url = new URL(pathname, pageOrigin()).toString();

  document.title = title;
  upsertCanonical(url);
  upsertMetaByName('description', description);
  upsertMetaByProperty('og:title', title);
  upsertMetaByProperty('og:description', description);
  upsertMetaByProperty('og:url', url);
  upsertMetaByName('twitter:title', title);
  upsertMetaByName('twitter:description', description);
}
