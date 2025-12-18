import UploadSession from '../models/UploadSession.js';
import Chunk from '../models/Chunk.js';
import discordService from '../services/discord.js';
import logger from '../utils/logger.js';

export const downloadFile = async (req, res) => {
    try {
        const { uploadId } = req.params;
        const session = await UploadSession.findOne({ uploadId });

        if (!session) {
            return res.status(404).json({ error: 'File not found' });
        }

        if (session.status !== 'completed') {
            return res.status(400).json({ error: 'File upload not complete' });
        }

        // Set headers
        res.setHeader('Content-Type', session.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${session.fileName}"`);
        res.setHeader('Content-Length', session.fileSize);

        // Stream chunks
        for (let i = 0; i < session.totalChunks; i++) {
            const chunk = await Chunk.findOne({ uploadId, chunkIndex: i });
            if (!chunk) {
                throw new Error(`Chunk ${i} missing for upload ${uploadId}`);
            }

            const buffer = await discordService.downloadChunk(chunk.threadId, chunk.messageId);
            res.write(buffer);
        }

        res.end();
    } catch (error) {
        logger.error('Error downloading file:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to download file' });
        } else {
            res.end();
        }
    }
};
