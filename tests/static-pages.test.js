import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createStaticRoutes } from '../scripts/create-static-routes.mjs';

test('مولّد صفحات GitHub Pages ينشئ مدخل HTML لكل مسار معلن بما فيها المواد', async () => {
  const output = await mkdtemp(join(tmpdir(), 'tanagha-static-routes-'));
  try {
    await writeFile(join(output, 'index.html'), '<main>school-app-entry</main>');
    const routes = await createStaticRoutes(output);
    assert.ok(routes.includes('/subjects/math'));
    assert.ok(routes.includes('/login/parent'));
    assert.ok(routes.includes('/admin/teacher-requests'));
    for (const route of routes.filter(path => path !== '/')) {
      const page = await readFile(join(output, route.slice(1), 'index.html'), 'utf8');
      assert.equal(page, '<main>school-app-entry</main>', `missing entry page for ${route}`);
    }
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
