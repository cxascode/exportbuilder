import fs from 'node:fs/promises';
import path from 'node:path';

const SITE_ORIGIN = 'https://cxascode.github.io';
const BASE_PATH = '/exportbuilder';
const PUBLIC_DIR = path.resolve('public');
const RESOURCES_PATH = path.resolve('src/data/resources.json');
const lastmod = new Date().toISOString().slice(0, 10);

async function loadResourcePaths() {
  const raw = await fs.readFile(RESOURCES_PATH, 'utf8');
  const resources = JSON.parse(raw);

  if (!Array.isArray(resources)) return [];

  return resources
    .filter((type) => typeof type === 'string' && type.trim())
    .sort()
    .map((type) => `${BASE_PATH}/${encodeURIComponent(type.trim())}`);
}

function buildSitemap(urls) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (loc) => `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`
  )
  .join('\n')}
</urlset>
`;

  const txt = `${urls.join('\n')}\n`;
  return { xml, txt };
}

async function write() {
  const resourcePaths = await loadResourcePaths();
  const urls = [`${SITE_ORIGIN}${BASE_PATH}/`, ...resourcePaths.map((p) => `${SITE_ORIGIN}${p}`)];
  const { xml, txt } = buildSitemap(urls);

  await Promise.all([
    fs.writeFile(path.join(PUBLIC_DIR, 'sitemap.xml'), xml, 'utf8'),
    fs.writeFile(path.join(PUBLIC_DIR, 'sitemap.txt'), txt, 'utf8'),
    fs.writeFile(path.join(PUBLIC_DIR, '.nojekyll'), '', 'utf8'),
  ]);

  console.log(
    `Wrote sitemaps (lastmod=${lastmod}, urls=${urls.length}, resources=${resourcePaths.length})`
  );
}

write();
