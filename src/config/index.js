import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  // Discord Configuration
  discord: {
    token: process.env.DISCORD_TOKEN,
    guildId: process.env.GUILD_ID,
    channelId: process.env.CHANNEL_ID,
    maxFileSize: 25 * 1024 * 1024, // 25MB per chunk
    maxChunksPerFile: 1000, // Maximum chunks per file
  },

  // Database Configuration
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/discord-storage',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },

  // Application Configuration
  app: {
    chunkSize: 24 * 1024 * 1024, // 24MB chunks (leaving 1MB buffer)
    downloadPath: process.env.DOWNLOAD_PATH || './downloads',
    tempPath: process.env.TEMP_PATH || './temp',
    maxRetries: 3,
    retryDelay: 1000, // 1 second
    port: process.env.PORT || 3000,
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined',
  },
};

// Validation
const requiredEnvVars = ['DISCORD_TOKEN', 'GUILD_ID', 'CHANNEL_ID'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0 && process.env.USE_MOCK_DISCORD !== 'true') {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

export default config;
