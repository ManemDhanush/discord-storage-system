import mongoose from 'mongoose';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';
import { DiscordService } from './DiscordService.js';
import { FileChunker } from './FileChunker.js';
import FileManifest from '../models/FileManifest.js';
import Thread from '../models/Thread.js';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';

export class StorageService {
  constructor() {
    this.discordService = new DiscordService();
    this.fileChunker = new FileChunker();
    this.isInitialized = false;
  }

  /**
   * Initialize the storage service
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Connect to database
      await mongoose.connect(config.database.uri, config.database.options);
      logger.info('Connected to MongoDB');

      // Initialize Discord service
      await this.discordService.initialize();
      
      this.isInitialized = true;
      logger.info('Storage service initialized');
    } catch (error) {
      logger.error('Error initializing storage service:', error);
      throw error;
    }
  }

  /**
   * Upload a file to Discord storage
   * @param {string} filePath - Path to the file to upload
   * @param {Object} options - Upload options
   * @returns {Promise<Object>} Upload result
   */
  async uploadFile(filePath, options = {}) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Validate file exists
      if (!await fs.pathExists(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const stats = await fs.stat(filePath);
      const fileName = path.basename(filePath);
      
      logger.info(`Starting upload: ${fileName} (${stats.size} bytes)`);

      // Generate unique file ID
      const fileId = crypto.randomUUID();
      
      // Chunk the file
      const chunkInfo = await this.fileChunker.chunkFile(filePath);
      
      // Create file manifest
      const manifest = new FileManifest({
        fileId,
        originalName: fileName,
        originalSize: stats.size,
        mimeType: chunkInfo.mimeType,
        hash: chunkInfo.fileHash,
        totalChunks: chunkInfo.totalChunks,
        status: 'uploading',
      });

      // Get or create thread
      const threadName = options.threadName || `file-${fileId.substring(0, 8)}`;
      const thread = await this.discordService.getOrCreateThread(threadName);
      
      manifest.threadId = thread.threadId;
      manifest.guildId = thread.guildId;
      manifest.channelId = thread.channelId;

      // Upload chunks
      const chunks = [];
      for (let i = 0; i < chunkInfo.chunks.length; i++) {
        const chunk = chunkInfo.chunks[i];
        
        try {
          const messageId = await this.discordService.uploadChunk(
            thread.threadId,
            chunk.chunkPath,
            i,
            chunkInfo.totalChunks
          );

          const chunkData = {
            chunkIndex: i,
            messageId,
            threadId: thread.threadId,
            size: chunk.size,
            hash: chunk.chunkHash,
          };

          chunks.push(chunkData);
          manifest.chunks.push(chunkData);

          logger.info(`Uploaded chunk ${i + 1}/${chunkInfo.totalChunks}`);
        } catch (error) {
          logger.error(`Error uploading chunk ${i}:`, error);
          manifest.status = 'failed';
          manifest.error = {
            message: error.message,
            code: 'CHUNK_UPLOAD_FAILED',
            timestamp: new Date(),
          };
          break;
        }
      }

      // Update manifest status
      if (manifest.status !== 'failed') {
        manifest.status = 'completed';
      }

      await manifest.save();

      // Update thread statistics
      await thread.incrementFileCount(stats.size);

      // Clean up temporary chunks
      await this.fileChunker.cleanupChunks(chunkInfo.chunks);

      logger.info(`Upload completed: ${fileName} (${chunks.length} chunks)`);

      return {
        fileId,
        fileName,
        fileSize: stats.size,
        totalChunks: chunks.length,
        threadId: thread.threadId,
        status: manifest.status,
      };
    } catch (error) {
      logger.error('Error uploading file:', error);
      throw error;
    }
  }

  /**
   * Download a file from Discord storage
   * @param {string} fileId - File ID to download
   * @param {string} outputPath - Output path for the file
   * @returns {Promise<Object>} Download result
   */
  async downloadFile(fileId, outputPath) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Find file manifest
      const manifest = await FileManifest.findOne({ fileId });
      if (!manifest) {
        throw new Error(`File not found: ${fileId}`);
      }

      if (manifest.status !== 'completed') {
        throw new Error(`File not ready for download: ${manifest.status}`);
      }

      logger.info(`Starting download: ${manifest.originalName}`);

      // Validate chunks
      const validation = manifest.validateChunks();
      if (!validation.isValid) {
        throw new Error(`File chunks are corrupted: missing ${validation.missingChunks.length} chunks`);
      }

      // Create temporary directory for chunks
      const tempDir = path.join(config.app.tempPath, `download_${fileId}`);
      await fs.ensureDir(tempDir);

      try {
        // Download all chunks
        const chunkPaths = [];
        for (const chunk of manifest.chunks) {
          const chunkPath = path.join(tempDir, `chunk_${chunk.chunkIndex}.bin`);
          await this.discordService.downloadChunk(
            chunk.threadId,
            chunk.messageId,
            chunkPath
          );
          chunkPaths.push({
            chunkIndex: chunk.chunkIndex,
            chunkPath,
            chunkHash: chunk.hash,
          });
        }

        // Reconstruct file
        await this.fileChunker.reconstructFile(chunkPaths, outputPath);

        // Verify file integrity
        const downloadedHash = await this.fileChunker.calculateFileHash(outputPath);
        if (downloadedHash !== manifest.hash) {
          throw new Error('Downloaded file hash does not match manifest');
        }

        // Update last accessed
        manifest.lastAccessed = new Date();
        await manifest.save();

        logger.info(`Download completed: ${manifest.originalName}`);

        return {
          fileId,
          fileName: manifest.originalName,
          fileSize: manifest.originalSize,
          outputPath,
        };
      } finally {
        // Clean up temporary chunks
        await fs.remove(tempDir);
      }
    } catch (error) {
      logger.error('Error downloading file:', error);
      throw error;
    }
  }

  /**
   * List files in storage
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of files
   */
  async listFiles(options = {}) {
    try {
      const query = {};
      
      if (options.status) {
        query.status = options.status;
      }
      
      if (options.search) {
        query.originalName = new RegExp(options.search, 'i');
      }

      const files = await FileManifest.find(query)
        .sort({ uploadedAt: -1 })
        .limit(options.limit || 50)
        .select('fileId originalName originalSize uploadedAt status');

      return files;
    } catch (error) {
      logger.error('Error listing files:', error);
      throw error;
    }
  }

  /**
   * Get file information
   * @param {string} fileId - File ID
   * @returns {Promise<Object>} File information
   */
  async getFileInfo(fileId) {
    try {
      const manifest = await FileManifest.findOne({ fileId });
      if (!manifest) {
        throw new Error(`File not found: ${fileId}`);
      }

      return {
        fileId: manifest.fileId,
        originalName: manifest.originalName,
        originalSize: manifest.originalSize,
        mimeType: manifest.mimeType,
        hash: manifest.hash,
        totalChunks: manifest.totalChunks,
        status: manifest.status,
        uploadedAt: manifest.uploadedAt,
        lastAccessed: manifest.lastAccessed,
        threadId: manifest.threadId,
      };
    } catch (error) {
      logger.error('Error getting file info:', error);
      throw error;
    }
  }

  /**
   * Delete a file from storage
   * @param {string} fileId - File ID to delete
   * @returns {Promise<Object>} Delete result
   */
  async deleteFile(fileId) {
    try {
      const manifest = await FileManifest.findOne({ fileId });
      if (!manifest) {
        throw new Error(`File not found: ${fileId}`);
      }

      // Update thread statistics
      const thread = await Thread.findOne({ threadId: manifest.threadId });
      if (thread) {
        await thread.decrementFileCount(manifest.originalSize);
      }

      // Delete manifest
      await FileManifest.deleteOne({ fileId });

      logger.info(`File deleted: ${manifest.originalName}`);

      return {
        fileId,
        fileName: manifest.originalName,
        deleted: true,
      };
    } catch (error) {
      logger.error('Error deleting file:', error);
      throw error;
    }
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    try {
      await this.discordService.cleanup();
      await mongoose.disconnect();
      logger.info('Storage service cleaned up');
    } catch (error) {
      logger.error('Error cleaning up storage service:', error);
    }
  }
}
