import crypto from 'crypto';
import UploadSession from '../models/UploadSession.js';
import Chunk from '../models/Chunk.js';
import discordService from '../services/discord.js';
import logger from '../utils/logger.js';
import { config } from '../config/index.js';

export const initUpload = async (req, res) => {
    try {
        const { fileName, fileSize, mimeType } = req.body;

        if (!fileName || !fileSize) {
            return res.status(400).json({ error: 'Missing fileName or fileSize' });
        }

        const chunkSize = config.app.chunkSize;
        const totalChunks = Math.ceil(fileSize / chunkSize);
        const uploadId = crypto.randomUUID();

        const session = new UploadSession({
            uploadId,
            fileName,
            fileSize,
            chunkSize,
            totalChunks,
            mimeType,
            status: 'pending',
        });

        await session.save();

        res.status(201).json({
            uploadId,
            chunkSize,
            totalChunks,
        });
    } catch (error) {
        logger.error('Error initializing upload:', error);
        res.status(500).json({ error: 'Failed to initialize upload' });
    }
};

export const uploadChunk = async (req, res) => {
    try {
        const { uploadId, chunkIndex } = req.params;
        const chunkData = req.body; // Raw buffer

        if (!chunkData || chunkData.length === 0) {
            return res.status(400).json({ error: 'Empty chunk data' });
        }

        const index = parseInt(chunkIndex);
        if (isNaN(index)) {
            return res.status(400).json({ error: 'Invalid chunk index' });
        }

        // Check if session exists
        const session = await UploadSession.findOne({ uploadId });
        if (!session) {
            return res.status(404).json({ error: 'Upload session not found' });
        }

        // Idempotency check
        const existingChunk = await Chunk.findOne({ uploadId, chunkIndex: index });
        if (existingChunk) {
            return res.status(200).json({ message: 'Chunk already uploaded' });
        }

        // Calculate hash
        const hash = crypto.createHash('sha256').update(chunkData).digest('hex');

        // Get thread ID (create one if not exists for this session, or use a common one)
        // For simplicity, we'll use a thread per file or a shared thread.
        // The original code used a thread per file.
        // We need to store threadId in UploadSession or determine it.
        // Let's use the session ID to create/get a thread.
        const threadName = `upload-${uploadId.substring(0, 8)}`;
        const thread = await discordService.getOrCreateThread(threadName);

        // Upload to Discord
        const messageId = await discordService.uploadChunk(
            thread.threadId,
            chunkData,
            index,
            session.totalChunks
        );

        // Save chunk record
        const chunk = new Chunk({
            uploadId,
            chunkIndex: index,
            messageId,
            threadId: thread.threadId,
            hash,
            size: chunkData.length,
        });

        await chunk.save();

        // Update session
        await UploadSession.updateOne(
            { uploadId },
            {
                $addToSet: { chunks: index },
                $set: { status: 'uploading' }
            }
        );

        // Check if upload is complete
        const updatedSession = await UploadSession.findOne({ uploadId });
        if (updatedSession.chunks.length === updatedSession.totalChunks) {
            updatedSession.status = 'completed';
            await updatedSession.save();
        }

        res.status(200).json({ message: 'Chunk uploaded successfully' });
    } catch (error) {
        logger.error(`Error uploading chunk ${req.params.chunkIndex}:`, error);
        res.status(500).json({ error: 'Failed to upload chunk' });
    }
};

export const getUploadStatus = async (req, res) => {
    try {
        const { uploadId } = req.params;
        const session = await UploadSession.findOne({ uploadId });

        if (!session) {
            return res.status(404).json({ error: 'Upload session not found' });
        }

        const uploadedChunks = session.chunks.sort((a, b) => a - b);
        const missingChunks = [];
        for (let i = 0; i < session.totalChunks; i++) {
            if (!uploadedChunks.includes(i)) {
                missingChunks.push(i);
            }
        }

        res.json({
            uploadId: session.uploadId,
            status: session.status,
            totalChunks: session.totalChunks,
            uploadedChunks,
            missingChunks,
        });
    } catch (error) {
        logger.error('Error getting upload status:', error);
        res.status(500).json({ error: 'Failed to get upload status' });
    }
};
