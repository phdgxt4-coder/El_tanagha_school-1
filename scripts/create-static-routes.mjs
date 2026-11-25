import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { subjects } from '../src/data/catalog.js';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));

export async function createStaticRoutes(outputDirectory = 'dist') {
  const outputRoot = resolve(repositoryRoot, outputDirectory);
  const entryPage = join(outputRoot, 'index.html');
  const manifest = JSON.parse(await readFile(join(repositoryRoot, 'public/manus-routes.json'), 'utf8'));
  const routes = manifest.routes.flatMap(({ path }) => path.includes(':id')
    ? subjects.map(({ id }) => path.replace(':id', id))
    : [path]);

  for (const route of routes) {
    if (!route.startsWith('/') || route.includes('..')) throw new Error(`مسار نشر غير صالح: ${route}`);
    if (route === '/') continue;
    const target = join(outputRoot, route.slice(1), 'index.html');
    await mkdir(join(outputRoot, route.slice(1)), { recursive: true });
    await copyFile(entryPage, target);
  }
  return routes;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputDirectory = process.argv[2] || 'dist';
  const routes = await createStaticRoutes(outputDirectory);
  console.log(`Created static entry pages for ${routes.length} declared routes.`);
}
