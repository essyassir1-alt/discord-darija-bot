import { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } from 'discord.js';
import { config } from './config.js';
import { logger } from './utils.js';
import { joinVoiceChannel, leaveVoiceChannel, cleanupSession } from './voice.js';

// Slash command definitions
const commands = [
  new SlashCommandBuilder()
    .setName('join')
    .setDescription('Join your voice channel and start listening'),
  new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Leave the voice channel'),
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot latency'),
];

export function setupBot() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  // Ready event
  client.once('ready', async () => {
    logger.info(`✅ Bot logged in as ${client.user.tag}`);
    logger.info(`📡 Bot is in ${client.guilds.cache.size} guilds`);

    // Register slash commands
    try {
      const rest = new REST({ version: '10' }).setToken(config.discord.token);
      
      await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commands },
      );
      
      logger.info('✅ Slash commands registered successfully');
    } catch (error) {
      logger.error(`Failed to register commands: ${error.message}`);
    }

    // Set status
    client.user.setPresence({
      activities: [{ name: '💬 Moroccan Darija', type: 2 }],
      status: 'online',
    });
  });

  // Interaction create (slash commands)
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    try {
      switch (commandName) {
        case 'join':
          await joinVoiceChannel(interaction);
          break;
          
        case 'leave':
          await leaveVoiceChannel(interaction);
          break;
          
        case 'ping':
          const latency = client.ws.ping;
          await interaction.reply(`🏓 Pong! Latency: ${latency}ms`);
          break;
          
        default:
          await interaction.reply('Command not found.');
      }
    } catch (error) {
      logger.error(`Command error: ${error.message}`);
      await interaction.reply('عفوا، شي مشكل وقع. عاود حاول.');
    }
  });

  // Voice state update - auto cleanup
  client.on('voiceStateUpdate', (oldState, newState) => {
    // If bot leaves voice channel, cleanup
    if (oldState.member.id === client.user.id && !newState.channelId) {
      cleanupSession(oldState.guild.id);
    }
  });

  // Error handling
  client.on('error', (error) => {
    logger.error(`Client error: ${error.message}`);
  });

  client.on('disconnect', () => {
    logger.warn('Bot disconnected');
  });

  client.on('reconnecting', () => {
    logger.info('Bot reconnecting...');
  });

  return client;
}
