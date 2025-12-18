import mongoose from 'mongoose';

const threadSchema = new mongoose.Schema({
  // Thread identification
  threadId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  
  // Discord server information
  guildId: {
    type: String,
    required: true,
    index: true,
  },
  
  channelId: {
    type: String,
    required: true,
    index: true,
  },
  
  // Thread metadata
  name: {
    type: String,
    required: true,
  },
  
  // Usage statistics
  fileCount: {
    type: Number,
    default: 0,
  },
  
  totalSize: {
    type: Number,
    default: 0,
  },
  
  lastUsed: {
    type: Date,
    default: Date.now,
    index: true,
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  
  // Error tracking
  errorCount: {
    type: Number,
    default: 0,
  },
  
  lastError: {
    message: String,
    timestamp: Date,
  },
}, {
  timestamps: true,
});

// Indexes for efficient queries
threadSchema.index({ guildId: 1, channelId: 1 });
threadSchema.index({ isActive: 1, lastUsed: -1 });
threadSchema.index({ fileCount: -1 });

// Method to increment file count
threadSchema.methods.incrementFileCount = function(size = 0) {
  this.fileCount += 1;
  this.totalSize += size;
  this.lastUsed = new Date();
  return this.save();
};

// Method to decrement file count
threadSchema.methods.decrementFileCount = function(size = 0) {
  this.fileCount = Math.max(0, this.fileCount - 1);
  this.totalSize = Math.max(0, this.totalSize - size);
  return this.save();
};

// Static method to find active threads
threadSchema.statics.findActive = function() {
  return this.find({ isActive: true }).sort({ lastUsed: -1 });
};

// Static method to find least used thread
threadSchema.statics.findLeastUsed = function() {
  return this.findOne({ isActive: true }).sort({ lastUsed: 1 });
};

export default mongoose.model('Thread', threadSchema);
