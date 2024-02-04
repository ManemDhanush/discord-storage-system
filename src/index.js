require('dotenv').config();
// const {upload} = require('./api/discord/upload');
const {Client, IntentsBitField, Attachment} = require('discord.js');
const mongoose = require('mongoose');
const Thread = require('./model/thread');

// Create a new client instance with intents (basically set of permissions that the bot needs)
const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent
    ]
});

// When the client is ready, run this code (only once)
client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

// Gets called when a message is sent
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    switch (message.content.split(' ')[0]) {
        case '!upload':
            upload(message, message.content.split(' ')[1]);
            break;

        case '!download':
            download(client, message, message.content.split(' ')[1]);
            break;
    }
});

async function upload(message, title) {

    // connection to the database discord
    mongoose.connect('mongodb://localhost:27017/discord').then(() => {
        // console.log("connected to mongo")
    }).catch(err => {
        console.log(err)
    })
    const thread = await message.channel.threads.create({
        name: title,
        reason: 'User requested a thread'
    });

    // creating a thread with the guild id, channel id and thread id
    const newThread = new Thread({
        GUILD_ID: process.env.GUILD_ID,
        CHANNEL_ID: process.env.CHANNEL_ID,
        THREAD_ID: thread.id,
        NAME: thread.name
    })
    // saving the thread
    newThread.save().then(() => {
        // console.log("new thread created")
    }).catch(err => {
        console.log(err)
    })
    await thread.join();
    
    // actual sending of the message to the thread o nteh database
    // will add more here with the attachments
    await thread.send(`Created and joined thread: ${thread.name}`);
}

async function download(client, message, title) {

    // connection to the database discord
    mongoose.connect('mongodb://localhost:27017/discord').then(() => {
        // console.log("connected to mongo")
    }).catch(err => {
        console.log(err)
    })

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
        reversedMessages.forEach(msg => {
            console.log(`${msg.author.tag}: ${msg.content}`);
        });
    } catch (error) {
        console.log(error)
    }
}

// bot login
client.login(process.env.LOGIN_TOKEN)
