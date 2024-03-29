const {Client, IntentsBitField} = require('discord.js');
const mongoose = require('mongoose');
const Thread = require('../../model/thread');
const request = require('request');
const fs = require('fs');
const { default: axios } = require('axios');

// the format to download is node src/index.js -d "title"
async function download(title) {
    
    // Create a new client instance with intents (basically set of permissions that the bot needs)
    const client = new Client({
        intents: [
            IntentsBitField.Flags.Guilds,
            IntentsBitField.Flags.GuildMembers,
            IntentsBitField.Flags.GuildMessages,
            IntentsBitField.Flags.MessageContent
        ]
    });

    mongoose.connect('mongodb://localhost:27017/discord').then(() => {
        console.log("connected to mongo")
    }). catch(err => {
        console.log(err)
    })
    
    client.on('ready', async () => {
        console.log(`Logged in as ${client.user.tag}!`);

        try {
            // fetching a thread from the database
            const res = await Thread.findOne({
                NAME: title
            })
    
            const guild = client.guilds.cache.get(res.GUILD_ID);
            const channel = guild.channels.cache.get(res.CHANNEL_ID);
            const thread = channel.threads.cache.get(res.THREAD_ID);
    
            // fetching the messages from the thread using guild id, channel id and thread id
            const messages = await thread.messages.fetch();
    
            // reversing as the latest message will be featched first
            const reversedMessages = messages.reverse();
            reversedMessages.forEach(async msg => {
                if(msg.attachments.size > 0) {
                    console.log("found attachment");
                    const fileUrl = msg.attachments.first().url;
                    const response = await axios({
                        url: fileUrl,
                        method: 'GET',
                        responseType: 'stream'
                    });

                    response.data.pipe(fs.createWriteStream(`./downloads/${msg.attachments.first().name}`));
                    console.log("saved " + msg.attachments.first().name + " to downloads folder");
                }
            });
        } catch (error) {
            console.log(error)
        }
        await client.destroy();
    });

    client.login(process.env.LOGIN_TOKEN);
}

module.exports = download