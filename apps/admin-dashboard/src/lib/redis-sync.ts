import net from 'node:net';

export const RBAC_SYNC_CHANNEL = 'channel:rbac:sync';

/**
 * Lightweight Redis Pub/Sub notifier for sub-5ms RBAC & supervisor synchronization
 */
export async function notifyRbacSync(payload: Record<string, unknown> = {}): Promise<void> {
  return new Promise((resolve) => {
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    let host = '127.0.0.1';
    let port = 6379;
    let password = '';
    try {
      const u = new URL(redisUrl);
      host = u.hostname || host;
      port = u.port ? parseInt(u.port, 10) : port;
      password = u.password || '';
    } catch {}

    const client = net.createConnection({ host, port, timeout: 1500 }, () => {
      if (password) {
        const authCmd = `*2\r\n$4\r\nAUTH\r\n$${Buffer.byteLength(password)}\r\n${password}\r\n`;
        client.write(authCmd);
      }
      const channel = RBAC_SYNC_CHANNEL;
      const msg = JSON.stringify({ timestamp: Date.now(), ...payload });
      const cmd = `*3\r\n$7\r\nPUBLISH\r\n$${Buffer.byteLength(channel)}\r\n${channel}\r\n$${Buffer.byteLength(msg)}\r\n${msg}\r\n`;
      client.write(cmd, () => {
        client.end();
        resolve();
      });
    });

    client.on('error', () => resolve());
    client.on('timeout', () => {
      client.destroy();
      resolve();
    });
  });
}
