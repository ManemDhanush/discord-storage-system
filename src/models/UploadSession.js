import mongoose from 'mongoose';

const uploadSessionSchema = new mongoose.Schema({
    uploadId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    fileName: {
        type: String,
        required: true,
    },
    fileSize: {
        type: Number,
        required: true,
    },
    chunkSize: {
        type: Number,
        required: true,
    },
    totalChunks: {
        type: Number,
        required: true,
    },
    mimeType: {
        type: String,
        default: 'application/octet-stream',
    },
    status: {
        type: String,
        enum: ['pending', 'uploading', 'completed', 'failed'],
        default: 'pending',
        index: true,
    },
    chunks: [{
        type: Number, // Store just the indices of uploaded chunks
    }],
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 86400, // Auto-expire after 24 hours
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

uploadSessionSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

export default mongoose.model('UploadSession', uploadSessionSchema);
