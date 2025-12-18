import mongoose from 'mongoose';

const fileManifestSchema = new mongoose.Schema({
  // File identification
  fileId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  
  // Original file information
  originalName: {
    type: String,
    required: true,
  },
  
  originalSize: {
    type: Number,
    required: true,
  },
  
  mimeType: {
    type: String,
    required: true,
  },
  
  hash: {
    type: String,
    required: true,
    index: true,
  },
  
  // Chunk information
  totalChunks: {
    type: Number,
    required: true,
  },
  
  chunks: [{
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
    size: {
      type: Number,
      required: true,
    },
    hash: {
      type: String,
      required: true,
    },
  }],
  
  // Discord thread information
  threadId: {
    type: String,
    required: true,
    index: true,
  },
  
  guildId: {
    type: String,
    required: true,
  },
  
  channelId: {
    type: String,
    required: true,
  },
  
  // Metadata
  uploadedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  
  lastAccessed: {
    type: Date,
    default: Date.now,
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['uploading', 'completed', 'failed', 'corrupted'],
    default: 'uploading',
    index: true,
  },
  
  // Error information
  error: {
    message: String,
    code: String,
    timestamp: Date,
  },
  
  // Access control
  isPublic: {
    type: Boolean,
    default: false,
  },
  
  tags: [String],
  
  description: String,
}, {
  timestamps: true,
});

// Indexes for efficient queries
fileManifestSchema.index({ hash: 1 });
fileManifestSchema.index({ originalName: 1 });
fileManifestSchema.index({ uploadedAt: -1 });
fileManifestSchema.index({ status: 1, uploadedAt: -1 });

// Virtual for checking if file is complete
fileManifestSchema.virtual('isComplete').get(function() {
  return this.status === 'completed' && this.chunks.length === this.totalChunks;
});

// Method to validate chunk integrity
fileManifestSchema.methods.validateChunks = function() {
  const expectedChunks = Array.from({ length: this.totalChunks }, (_, i) => i);
  const actualChunks = this.chunks.map(chunk => chunk.chunkIndex).sort((a, b) => a - b);
  
  return {
    isValid: JSON.stringify(expectedChunks) === JSON.stringify(actualChunks),
    missingChunks: expectedChunks.filter(i => !actualChunks.includes(i)),
    extraChunks: actualChunks.filter(i => !expectedChunks.includes(i)),
  };
};

// Method to get chunk by index
fileManifestSchema.methods.getChunk = function(index) {
  return this.chunks.find(chunk => chunk.chunkIndex === index);
};

// Static method to find by hash
fileManifestSchema.statics.findByHash = function(hash) {
  return this.findOne({ hash });
};

// Static method to find by name
fileManifestSchema.statics.findByName = function(name) {
  return this.find({ originalName: new RegExp(name, 'i') });
};

export default mongoose.model('FileManifest', fileManifestSchema);
