require('dotenv').config();
const {Client, IntentsBitField} = require('discord.js');

function download(text) {
    
    // Create a new client instance with intents (basically set of permissions that the bot needs)
    const client = new Client({
        intents: [
            IntentsBitField.Flags.Guilds,
            IntentsBitField.Flags.GuildMembers,
            IntentsBitField.Flags.GuildMessages,
            IntentsBitField.Flags.MessageContent
        ]
    });
    
    client.on('ready', async () => {
        console.log(`Logged in as ${client.user.tag}!`);
        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        const channel = guild.channels.cache.get(process.env.CHANNEL_ID);
        const thread = channel.threads.cache.get(process.env.THREAD_ID);
        const messages = await thread.messages.fetch();
        messages.forEach(msg => {
            console.log(`${msg.author.tag}: ${msg.content}`);
        });
    });
}

export default download;