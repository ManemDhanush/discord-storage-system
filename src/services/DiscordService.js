import { Client, GatewayIntentBits } from 'discord.js';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';
import Thread from '../models/Thread.js';

export class DiscordService {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  /**
   * Initialize Discord client
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isConnected) return;

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    return new Promise((resolve, reject) => {
      this.client.once('ready', () => {
        logger.info(`Discord client ready: ${this.client.user.tag}`);
        this.isConnected = true;
        resolve();
      });

      this.client.on('error', (error) => {
        logger.error('Discord client error:', error);
        reject(error);
      });

      this.client.login(config.discord.token);
    });
  }

  /**
   * Get or create a thread for file storage
   * @param {string} threadName - Name for the thread
   * @returns {Promise<Object>} Thread information
   */
  async getOrCreateThread(threadName) {
    try {
      // Check if thread already exists in database
      let threadRecord = await Thread.findOne({ name: threadName, isActive: true });

      if (threadRecord) {
        logger.info(`Using existing thread: ${threadName}`);
        return threadRecord;
      }

      // Create new thread
      const guild = this.client.guilds.cache.get(config.discord.guildId);
      if (!guild) {
        throw new Error(`Guild not found: ${config.discord.guildId}`);
      }

      const channel = guild.channels.cache.get(config.discord.channelId);
      if (!channel) {
        throw new Error(`Channel not found: ${config.discord.channelId}`);
      }

      const thread = await channel.threads.create({
        name: threadName,
        reason: 'File storage thread',
      });

      // Join the thread
      await thread.join();

      // Save to database
      threadRecord = new Thread({
        threadId: thread.id,
        guildId: config.discord.guildId,
        channelId: config.discord.channelId,
        name: threadName,
      });

      await threadRecord.save();
      logger.info(`Created new thread: ${threadName} (${thread.id})`);

      return threadRecord;
    } catch (error) {
      logger.error('Error getting/creating thread:', error);
      throw error;
    }
  }

  /**
   * Upload a chunk to Discord
   * @param {string} threadId - Thread ID
   * @param {Buffer} buffer - Chunk buffer
   * @param {number} chunkIndex - Chunk index
   * @param {number} totalChunks - Total number of chunks
   * @returns {Promise<string>} Message ID
   */
  async uploadChunk(threadId, buffer, chunkIndex, totalChunks) {
    try {
      const guild = this.client.guilds.cache.get(config.discord.guildId);
      const channel = guild.channels.cache.get(config.discord.channelId);
      const thread = channel.threads.cache.get(threadId);

      if (!thread) {
        throw new Error(`Thread not found: ${threadId}`);
      }

      const attachment = {
        attachment: buffer,
        name: `chunk_${chunkIndex}_${totalChunks}.bin`,
      };

      const message = await thread.send({
        content: `Chunk ${chunkIndex + 1}/${totalChunks}`,
        files: [attachment],
      });

      logger.info(`Uploaded chunk ${chunkIndex + 1}/${totalChunks} to thread ${threadId}`);
      return message.id;
    } catch (error) {
      logger.error(`Error uploading chunk ${chunkIndex}:`, error);
      throw error;
    }
  }

  /**
   * Download a chunk from Discord
   * @param {string} threadId - Thread ID
   * @param {string} messageId - Message ID
   * @returns {Promise<Buffer>} Downloaded chunk buffer
   */
  async downloadChunk(threadId, messageId) {
    try {
      const guild = this.client.guilds.cache.get(config.discord.guildId);
      const channel = guild.channels.cache.get(config.discord.channelId);
      const thread = channel.threads.cache.get(threadId);

      if (!thread) {
        throw new Error(`Thread not found: ${threadId}`);
      }

      const message = await thread.messages.fetch(messageId);
      if (!message || !message.attachments.size) {
        throw new Error(`Message not found or has no attachments: ${messageId}`);
      }

      const attachment = message.attachments.first();
      const response = await fetch(attachment.url);

      if (!response.ok) {
        throw new Error(`Failed to download attachment: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      logger.info(`Downloaded chunk from message ${messageId}`);
      return buffer;
    } catch (error) {
      logger.error(`Error downloading chunk from message ${messageId}:`, error);
      throw error;
    }
  }

  /**
   * Get all messages from a thread
   * @param {string} threadId - Thread ID
   * @returns {Promise<Array>} Array of messages
   */
  async getThreadMessages(threadId) {
    try {
      const guild = this.client.guilds.cache.get(config.discord.guildId);
      const channel = guild.channels.cache.get(config.discord.channelId);
      const thread = channel.threads.cache.get(threadId);

      if (!thread) {
        throw new Error(`Thread not found: ${threadId}`);
      }

      const messages = await thread.messages.fetch({ limit: 100 });
      return Array.from(messages.values());
    } catch (error) {
      logger.error(`Error fetching messages from thread ${threadId}:`, error);
      throw error;
    }
  }

  /**
   * Clean up Discord client
   */
  async cleanup() {
    if (this.client && this.isConnected) {
      await this.client.destroy();
      this.isConnected = false;
      logger.info('Discord client disconnected');
    }
  }
}
