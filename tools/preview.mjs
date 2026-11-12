// Development-only host for the real DSH client bundle. No build dependencies.
// node tools/preview.mjs --port 4177 [--vendor <directory containing React UMDs>]
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(here, '..');
const cdn = {
  '/react.js': 'https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js',
  '/react-dom.js': 'https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js',
};

export function createPreviewServer({ vendor = path.join(os.tmpdir(), 'codex-aimlabs-preview') } = {}) {
  const files = new Map([
    ['/', [path.join(here, 'preview.html'), 'text/html; charset=utf-8']],
    ['/preview.html', [path.join(here, 'preview.html'), 'text/html; charset=utf-8']],
    ['/client.js', [path.join(project, 'client.js'), 'text/javascript; charset=utf-8']],
    ['/react.js', [path.join(vendor, 'react.production.min.js'), 'text/javascript; charset=utf-8']],
    ['/react-dom.js', [path.join(vendor, 'react-dom.production.min.js'), 'text/javascript; charset=utf-8']],
  ]);

  return http.createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' });
      response.end('Method not allowed');
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    } catch {
      response.writeHead(400);
      response.end('Bad request');
      return;
    }
    if (pathname === '/health') {
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(request.method === 'HEAD' ? undefined : JSON.stringify({ ok: true, preview: 'Aim Trainer', vendor }));
      return;
    }
    if (pathname === '/favicon.ico') {
      response.writeHead(204);
      response.end();
      return;
    }
    // An explicit route table keeps project files, dotfiles and traversal paths private.
    const target = files.get(pathname);
    if (!target) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    try {
      const info = await stat(target[0]);
      if (!info.isFile()) throw Object.assign(new Error('Not a file'), { code: 'ENOENT' });
      const body = request.method === 'HEAD' ? undefined : await readFile(target[0]);
      response.writeHead(200, { 'Content-Type': target[1], 'Content-Length': info.size });
      response.end(body);
    } catch (error) {
      if (error.code === 'ENOENT' && cdn[pathname]) {
        // CDN use is confined to this development page; the shipped bundle uses host React.
        response.writeHead(302, { Location: cdn[pathname] });
        response.end();
      } else {
        response.writeHead(error.code === 'ENOENT' ? 404 : 500);
        response.end(error.code === 'ENOENT' ? 'Not found' : 'Could not read preview asset');
      }
    }
  });
}

function argumentsFrom(argv) {
  const result = { port: 4177 };
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    const value = flag.includes('=') ? flag.slice(flag.indexOf('=') + 1) : argv[++index];
    if (flag === '--port' || flag.startsWith('--port=')) result.port = Number(value);
    else if (flag === '--vendor' || flag.startsWith('--vendor=')) {
      if (!value) throw new Error('--vendor requires a directory');
      result.vendor = path.resolve(value);
    } else throw new Error(`Unknown argument: ${flag}`);
  }
  if (!Number.isInteger(result.port) || result.port < 0 || result.port > 65535) throw new Error('--port must be an integer from 0 to 65535');
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { port, ...options } = argumentsFrom(process.argv.slice(2));
    const server = createPreviewServer(options);
    server.on('error', (error) => { console.error(`Preview server: ${error.message}`); process.exitCode = 1; });
    server.listen(port, '127.0.0.1', () => {
      console.log(`Aim Trainer Preview: http://127.0.0.1:${server.address().port}/`);
      console.log(`React vendor directory: ${options.vendor || path.join(os.tmpdir(), 'codex-aimlabs-preview')}`);
    });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
