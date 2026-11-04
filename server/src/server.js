import http from 'node:http';
import cors from 'cors';
import express from 'express';
import { config } from './config.js';
import { prisma } from './db.js';
import { attachSocket } from './realtime/socket.js';
import { api, errorHandler } from './routes/api.js';

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '100kb' }));
app.use('/api', api);
app.use(errorHandler);

const server = http.createServer(app);
const realtime = attachSocket(server);

server.listen(config.port, () => {
  console.log(`🍃 Mosswood-Server läuft auf http://localhost:${config.port}`);
});

async function shutdown(signal) {
  console.log(`${signal} empfangen, fahre herunter …`);
  realtime.stop();
  realtime.io.close();
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
