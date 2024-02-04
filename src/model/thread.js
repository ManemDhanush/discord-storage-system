const mongoose = require('mongoose');

const threadSchema = new mongoose.Schema({
    GUILD_ID: String,
    CHANNEL_ID: String,
    THREAD_ID: String,
    NAME: String
})

module.exports = mongoose.model('Thread', threadSchema)