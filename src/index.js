import { config } from './config.js';
import { logger } from './utils.js';
import { setupBot } from './bot.js';

// Validate configuration
try {
  config.validate();
  logger.info('✅ Configuration validated');
} catch (error) {
  logger.error(`❌ Configuration error: ${error.message}`);
  process.exit(1);
}

// Start bot
const client = setupBot();

// Login to Discord
client.login(config.discord.token).catch((error) => {
  logger.error(`❌ Failed to login: ${error.message}`);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down gracefully...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down gracefully...');
  client.destroy();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error.message}`);
  logger.error(error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise);
  logger.error('Reason:', reason);
});
