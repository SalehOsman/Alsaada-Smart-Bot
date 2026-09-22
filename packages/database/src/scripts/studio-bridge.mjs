import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(__dirname, '../..');
const TARGET_PORT = 5556;
const PUBLIC_PORT = 5555;

console.log(`[Studio Bridge] Launching Prisma Studio on loopback port ${TARGET_PORT}...`);

const studioProcess = spawn('npx', ['prisma', 'studio', '--port', String(TARGET_PORT), '--browser', 'none'], {
  stdio: 'inherit',
  shell: true,
  cwd: packageDir,
});

const server = http.createServer((req, res) => {
  const headers = { ...req.headers };

  // Rewrite Origin and Host to match Prisma Studio's internal port to bypass strict Eur() origin check
  if (headers.origin) {
    headers.origin = headers.origin.replace(/:\d+$/, `:${TARGET_PORT}`);
  }
  if (headers.host) {
    headers.host = `localhost:${TARGET_PORT}`;
  }

  const proxyReq = http.request(
    {
      hostname: '127.0.0.1',
      port: TARGET_PORT,
      path: req.url,
      method: req.method,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('error', (err) => {
    console.error('[Studio Bridge Proxy Error]', err.message);
    if (!res.headersSent) {
      res.statusCode = 502;
      res.end('Bad Gateway');
    }
  });

  req.pipe(proxyReq);
});

// Support WebSocket / Connection Upgrade if needed
server.on('upgrade', (req, socket, head) => {
  const headers = { ...req.headers };
  if (headers.origin) {
    headers.origin = headers.origin.replace(/:\d+$/, `:${TARGET_PORT}`);
  }
  if (headers.host) {
    headers.host = `localhost:${TARGET_PORT}`;
  }

  const proxyReq = http.request({
    hostname: '127.0.0.1',
    port: TARGET_PORT,
    path: req.url,
    method: req.method,
    headers,
  });

  proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
    socket.write(
      `HTTP/${proxyRes.httpVersion} ${proxyRes.statusCode} ${proxyRes.statusMessage}\r\n` +
      Object.entries(proxyRes.headers)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\r\n') +
      '\r\n\r\n'
    );
    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
  });

  proxyReq.on('error', () => {
    socket.destroy();
  });

  proxyReq.end();
});

server.listen(PUBLIC_PORT, '0.0.0.0', () => {
  console.log(`[Studio Bridge] HTTP Proxy bound 0.0.0.0:${PUBLIC_PORT} -> forwarding with Origin adaptation to 127.0.0.1:${TARGET_PORT}`);
});

const shutdown = () => {
  console.log('[Studio Bridge] Shutting down Studio Bridge...');
  studioProcess.kill('SIGTERM');
  server.close();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
studioProcess.on('exit', (code) => {
  console.log(`[Studio Bridge] Prisma Studio exited with code ${code}`);
  server.close();
  process.exit(code ?? 0);
});
