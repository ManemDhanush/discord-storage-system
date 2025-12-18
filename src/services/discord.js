import { DiscordService } from './DiscordService.js';
import { MockDiscordService } from './MockDiscordService.js';
import logger from '../utils/logger.js';

const useMock = process.env.USE_MOCK_DISCORD === 'true';
const discordService = useMock ? new MockDiscordService() : new DiscordService();

export const initDiscord = async () => {
    try {
        await discordService.initialize();
        logger.info(`Discord service initialized successfully (Mock: ${useMock})`);
    } catch (error) {
        logger.error('Failed to initialize Discord service:', error);
        throw error;
    }
};

export default discordService;
