require('dotenv').config();
const {Client, IntentsBitField} = require('discord.js');
const mongoose = require('mongoose');
const Thread = require('../../model/thread');

// Create a new client instance with intents (basically set of permissions that the bot needs)

export default async function upload(text) {
    
    const client = new Client({
        intents: [
            IntentsBitField.Flags.Guilds,
            IntentsBitField.Flags.GuildMembers,
            IntentsBitField.Flags.GuildMessages,
            IntentsBitField.Flags.MessageContent
        ]
    });
    
    mongoose.connect('mongodb://localhost:27017/discord');
    
    client.on('ready', async () => {
        console.log(`Logged in as ${client.user.tag}!`);
        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        const channel = guild.channels.cache.get(process.env.CHANNEL_ID);
        const thread = await channel.threads.create({
            name: "fakeMessage", 
            reason: 'User requested a thread' // Optional reason for audit logs
        });
        const newThread = new Thread({
            GUILD_ID: process.env.GUILD_ID,
            CHANNEL_ID: process.env.CHANNEL_ID,
            THREAD_ID: thread.id,
            NAME: thread.name
        })
        newThread.save().then(() => {
            console.log("new thread created")
        }).catch(err => {
            console.log(err)
        })
        // Join the thread
        await thread.join();
        // Send a confirmation message
        await thread.send(`Created and joined thread: ${thread.name}`);
        await thread.send(text);
        console.log(thread)
    });

    client.login(process.env.LOGIN_TOKEN);
}
