import fs from 'fs-extra';
import path from 'path';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';

export class MockDiscordService {
    constructor() {
        this.storagePath = path.join(config.app.tempPath, 'mock_discord');
        fs.ensureDirSync(this.storagePath);
        logger.info(`Mock Discord Service initialized at ${this.storagePath}`);
    }

    async initialize() {
        return Promise.resolve();
    }

    async getOrCreateThread(threadName) {
        return {
            threadId: 'mock-thread-id',
            guildId: 'mock-guild-id',
            channelId: 'mock-channel-id',
        };
    }

    async uploadChunk(threadId, buffer, chunkIndex, totalChunks) {
        const messageId = crypto.randomUUID();
        const filePath = path.join(this.storagePath, messageId);
        await fs.writeFile(filePath, buffer);
        logger.info(`[Mock] Uploaded chunk ${chunkIndex} to ${messageId}`);
        return messageId;
    }

    async downloadChunk(threadId, messageId) {
        const filePath = path.join(this.storagePath, messageId);
        if (!await fs.pathExists(filePath)) {
            throw new Error(`[Mock] Message not found: ${messageId}`);
        }
        const buffer = await fs.readFile(filePath);
        logger.info(`[Mock] Downloaded chunk from ${messageId}`);
        return buffer;
    }
}
