import fs from 'fs-extra';
import crypto from 'crypto';
import path from 'path';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';

export class FileChunker {
  constructor() {
    this.chunkSize = config.app.chunkSize;
    this.tempPath = config.app.tempPath;
  }

  /**
   * Split a file into chunks
   * @param {string} filePath - Path to the file to chunk
   * @returns {Promise<Object>} Chunk information
   */
  async chunkFile(filePath) {
    try {
      await fs.ensureDir(this.tempPath);
      
      const stats = await fs.stat(filePath);
      const fileSize = stats.size;
      const totalChunks = Math.ceil(fileSize / this.chunkSize);
      
      logger.info(`Chunking file: ${filePath} (${fileSize} bytes, ${totalChunks} chunks)`);
      
      const chunks = [];
      const fileHash = await this.calculateFileHash(filePath);
      
      const fileStream = fs.createReadStream(filePath);
      let currentChunk = 0;
      let bytesRead = 0;
      
      return new Promise((resolve, reject) => {
        const chunkBuffers = [];
        let currentBuffer = Buffer.alloc(0);
        
        fileStream.on('data', async (data) => {
          currentBuffer = Buffer.concat([currentBuffer, data]);
          
          while (currentBuffer.length >= this.chunkSize && currentChunk < totalChunks) {
            const chunkData = currentBuffer.slice(0, this.chunkSize);
            currentBuffer = currentBuffer.slice(this.chunkSize);
            
            const chunkInfo = await this.createChunk(chunkData, currentChunk, filePath);
            chunks.push(chunkInfo);
            
            currentChunk++;
            bytesRead += chunkData.length;
          }
        });
        
        fileStream.on('end', async () => {
          // Handle remaining data
          if (currentBuffer.length > 0 && currentChunk < totalChunks) {
            const chunkInfo = await this.createChunk(currentBuffer, currentChunk, filePath);
            chunks.push(chunkInfo);
            currentChunk++;
          }
          
          resolve({
            originalPath: filePath,
            originalSize: fileSize,
            totalChunks,
            chunks,
            fileHash,
            mimeType: await this.getMimeType(filePath),
          });
        });
        
        fileStream.on('error', reject);
      });
    } catch (error) {
      logger.error('Error chunking file:', error);
      throw error;
    }
  }

  /**
   * Create a chunk file and return its information
   * @param {Buffer} chunkData - Chunk data
   * @param {number} chunkIndex - Chunk index
   * @param {string} originalPath - Original file path
   * @returns {Promise<Object>} Chunk information
   */
  async createChunk(chunkData, chunkIndex, originalPath) {
    const chunkHash = crypto.createHash('sha256').update(chunkData).digest('hex');
    const chunkFileName = `chunk_${chunkIndex}_${chunkHash.substring(0, 8)}.bin`;
    const chunkPath = path.join(this.tempPath, chunkFileName);
    
    await fs.writeFile(chunkPath, chunkData);
    
    return {
      chunkIndex,
      chunkPath,
      chunkHash,
      size: chunkData.length,
    };
  }

  /**
   * Reconstruct a file from chunks
   * @param {Array} chunks - Array of chunk information
   * @param {string} outputPath - Output file path
   * @returns {Promise<string>} Reconstructed file path
   */
  async reconstructFile(chunks, outputPath) {
    try {
      await fs.ensureDir(path.dirname(outputPath));
      
      // Sort chunks by index
      const sortedChunks = chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
      
      logger.info(`Reconstructing file from ${sortedChunks.length} chunks`);
      
      const writeStream = fs.createWriteStream(outputPath);
      
      for (const chunk of sortedChunks) {
        if (!await fs.pathExists(chunk.chunkPath)) {
          throw new Error(`Chunk file not found: ${chunk.chunkPath}`);
        }
        
        const chunkData = await fs.readFile(chunk.chunkPath);
        
        // Verify chunk hash
        const calculatedHash = crypto.createHash('sha256').update(chunkData).digest('hex');
        if (calculatedHash !== chunk.chunkHash) {
          throw new Error(`Chunk hash mismatch for chunk ${chunk.chunkIndex}`);
        }
        
        writeStream.write(chunkData);
      }
      
      writeStream.end();
      
      return new Promise((resolve, reject) => {
        writeStream.on('finish', () => {
          logger.info(`File reconstructed: ${outputPath}`);
          resolve(outputPath);
        });
        
        writeStream.on('error', reject);
      });
    } catch (error) {
      logger.error('Error reconstructing file:', error);
      throw error;
    }
  }

  /**
   * Calculate SHA256 hash of a file
   * @param {string} filePath - File path
   * @returns {Promise<string>} File hash
   */
  async calculateFileHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Get MIME type of a file
   * @param {string} filePath - File path
   * @returns {Promise<string>} MIME type
   */
  async getMimeType(filePath) {
    const mime = await import('mime-types');
    return mime.default.lookup(filePath) || 'application/octet-stream';
  }

  /**
   * Clean up temporary chunk files
   * @param {Array} chunks - Array of chunk information
   */
  async cleanupChunks(chunks) {
    try {
      for (const chunk of chunks) {
        if (await fs.pathExists(chunk.chunkPath)) {
          await fs.remove(chunk.chunkPath);
        }
      }
      logger.info(`Cleaned up ${chunks.length} chunk files`);
    } catch (error) {
      logger.error('Error cleaning up chunks:', error);
    }
  }
}
