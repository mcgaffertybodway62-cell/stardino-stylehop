import http from 'http';
import fs from 'fs';
import path from 'path';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
};

export function startStaticServer(rootDir, port = 0) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const reqUrl = new URL(req.url, 'http://127.0.0.1');
        let relPath = decodeURIComponent(reqUrl.pathname);
        if (relPath === '/favicon.ico') {
          res.writeHead(204);
          res.end();
          return;
        }
        if (relPath.endsWith('/')) relPath += 'index.html';
        const outRoot = path.resolve(process.env.STYLEHOP_OUT || path.join(rootDir, '..', 'out'));
        let absPath = path.resolve(rootDir, '.' + relPath);
        if (relPath.startsWith('/out/') && !fs.existsSync(absPath)) {
          const outSubPath = relPath.slice('/out/'.length);
          const candidate = path.resolve(outRoot, outSubPath);
          if (candidate.startsWith(outRoot)) {
            absPath = candidate;
          }
        }
        if (!absPath.startsWith(rootDir) && !absPath.startsWith(outRoot)) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }
        if (!fs.existsSync(absPath) || fs.statSync(absPath).isDirectory()) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        const ext = path.extname(absPath).toLowerCase();
        res.writeHead(200, {
          'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        fs.createReadStream(absPath).pipe(res);
      } catch (err) {
        res.writeHead(500);
        res.end(String(err));
      }
    });
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, port, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}
