import 'dotenv/config';
import app from './app.js';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/database.js';

const PORT = env.PORT || 5000;

async function startServer() {
  // Attempt MongoDB connection during startup sequence
  console.log('[SmartApartment Backend] Initializing database connection...');
  const dbConnected = await connectDB();
  if (!dbConnected) {
    console.warn('[SmartApartment Backend Warning] Database is currently offline. Non-database routes (such as health check) will function, but database-dependent features will fail.');
  }

  const server = app.listen(PORT, () => {
    console.log(`[SmartApartment Backend] Server running on port ${PORT}`);
    console.log(`[SmartApartment Backend] Health endpoint: http://localhost:${PORT}/api/v1/health`);
    console.log(`[SmartApartment Backend] Allowed CORS origin: ${env.CLIENT_URL}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[FATAL] Port ${PORT} is already occupied by another process. Identify and free port ${PORT} before restarting.`);
    } else {
      console.error(`[FATAL] Failed to start server: ${err.message}`);
    }
    process.exit(1);
  });

  // Graceful shutdown handling
  const shutdown = async (signal) => {
    console.log(`\n[SmartApartment Backend] Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      console.log('[SmartApartment Backend] HTTP server closed.');
      await disconnectDB();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return server;
}

startServer().catch((err) => {
  console.error('[FATAL] Failed to initialize server:', err.message);
  process.exit(1);
});
