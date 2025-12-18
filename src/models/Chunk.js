import mongoose from 'mongoose';

const chunkSchema = new mongoose.Schema({
    uploadId: {
        type: String,
        required: true,
        index: true,
    },
    chunkIndex: {
        type: Number,
        required: true,
    },
    messageId: {
        type: String,
        required: true,
    },
    threadId: {
        type: String,
        required: true,
    },
    hash: {
        type: String,
        required: true,
    },
    size: {
        type: Number,
        required: true,
    },
    uploadedAt: {
        type: Date,
        default: Date.now,
    },
});

// Compound index for unique chunks per upload
chunkSchema.index({ uploadId: 1, chunkIndex: 1 }, { unique: true });

export default mongoose.model('Chunk', chunkSchema);
