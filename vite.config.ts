import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));

// Картинки лаборатории лежат рядом с репозиторием и в git не попадают; папку кадров можно задать через LAB_FRAMES_DIR.
const LAB_ASSETS: Record<string, string> = {
  test: resolve(root, '../тест-картинки'),
  frames: process.env.LAB_FRAMES_DIR ?? resolve(root, '../кадры'),
};

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

/** /lab-assets/<папка>/ — список картинок, /lab-assets/<папка>/<файл> — сама картинка. Только для dev-сервера. */
function labAssets(): Plugin {
  return {
    name: 'lab-assets',
    configureServer(server) {
      server.middlewares.use('/lab-assets', (req, res, next) => {
        const [, key = '', ...rest] = decodeURIComponent((req.url ?? '').split('?')[0]).split('/');
        const dir = LAB_ASSETS[key];
        if (!dir || !existsSync(dir)) return next();
        if (rest.join('') === '') {
          const files = readdirSync(dir).filter((f) => MIME[extname(f).toLowerCase()]).sort();
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(files));
          return;
        }
        const file = normalize(join(dir, ...rest));
        if (!file.startsWith(dir + sep) || !existsSync(file) || !statSync(file).isFile()) {
          res.statusCode = 404;
          res.end();
          return;
        }
        res.setHeader('Content-Type', MIME[extname(file).toLowerCase()] ?? 'application/octet-stream');
        createReadStream(file).pipe(res);
      });
    },
  };
}

// Сайт живёт по адресу afest.github.io/steklyashka/, поэтому в сборке пути идут от /steklyashka/.
// Лаборатория открывается только в dev-режиме: её картинки лежат вне репозитория.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/steklyashka/' : '/',
  plugins: [labAssets()],
  build: {
    rollupOptions: {
      input: { main: resolve(root, 'index.html') },
    },
  },
}));
