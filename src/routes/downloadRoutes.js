import express from 'express';
import { downloadFile } from '../controllers/downloadController.js';

const router = express.Router();

router.get('/:uploadId', downloadFile);

export default router;
