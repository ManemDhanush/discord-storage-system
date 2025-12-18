import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { config } from './config/index.js';
import logger from './utils/logger.js';
import uploadRoutes from './routes/uploadRoutes.js';
import downloadRoutes from './routes/downloadRoutes.js';
import { initDiscord } from './services/discord.js';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(express.json());
app.use(express.raw({ type: 'application/octet-stream', limit: '50mb' })); // For chunk uploads

// Database connection & Discord initialization
mongoose.connect(config.database.uri, config.database.options)
    .then(async () => {
        logger.info('Connected to MongoDB');
        await initDiscord();
    })
    .catch(err => logger.error('Initialization error:', err));

// Routes
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

app.use('/uploads', uploadRoutes);
app.use('/downloads', downloadRoutes);

// Error handling
app.use((err, req, res, next) => {
    logger.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!', message: err.message });
});

// Start server
const PORT = config.app.port;
app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
});

export default app;
