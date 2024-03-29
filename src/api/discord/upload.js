const {Client, IntentsBitField} = require('discord.js');
const mongoose = require('mongoose');
const Thread = require('../../model/thread');

// the format to upload is node src/index.js -u "filePath" "title"
async function upload(filePath, title) {
    
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
        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        const channel = guild.channels.cache.get(process.env.CHANNEL_ID); // hardcoded for now
        const res = await Thread.findOne({
            NAME: title
        });
        let thread = null;
        if(res) {
            console.log("thread already exists so appending it to the same thread");
            thread = await channel.threads.cache.get(res.THREAD_ID);
        } else {
            thread = await channel.threads.create({
                name: title, 
                reason: 'User requested a thread' // Optional reason for audit logs
            });
            const newThread = new Thread({
                GUILD_ID: process.env.GUILD_ID,
                CHANNEL_ID: process.env.CHANNEL_ID,
                THREAD_ID: thread.id,
                NAME: thread.name
            });
            newThread.save().then(() => {
                console.log("new thread saved to database")
            }).catch(err => {
                console.log(err)
            })
            // Join the thread
            await thread.join();
        }
        console.log(thread);
        await thread.send({ files: [filePath] }).then(() => console.log("attachment sent successfully")); // yet add attachment support
        await client.destroy();
        process.exit(0);
    });

    client.login(process.env.LOGIN_TOKEN);
}

module.exports = upload