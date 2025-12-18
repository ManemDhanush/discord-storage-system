import express from 'express';
import { initUpload, uploadChunk, getUploadStatus } from '../controllers/uploadController.js';

const router = express.Router();

router.post('/init', initUpload);
router.put('/:uploadId/chunks/:chunkIndex', uploadChunk);
router.get('/:uploadId/status', getUploadStatus);

export default router;
