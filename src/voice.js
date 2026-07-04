import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, entersState } from '@discordjs/voice';
import { getVoiceConnection } from '@discordjs/voice';
import { logger } from './utils.js';
import { speechToText, generateResponse, textToSpeech, clearConversation } from './ai.js';

// Active voice sessions
const activeSessions = new Map();

export async function joinVoiceChannel(interaction) {
  const member = interaction.member;
  const voiceChannel = member.voice.channel;
  
  if (!voiceChannel) {
    await interaction.reply('أنت ماشي فـ Voice Channel! دوز لـ Voice Channel و عاود جرب.');
    return;
  }

  try {
    // Check if already connected
    const existingConnection = getVoiceConnection(voiceChannel.guildId);
    if (existingConnection) {
      await interaction.reply('أنا ديجا موجود فـ Voice Channel!');
      return;
    }

    // Join voice channel
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guildId,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });

    // Create audio player
    const player = createAudioPlayer();
    connection.subscribe(player);

    // Store session
    const sessionId = `${voiceChannel.guildId}-${voiceChannel.id}`;
    activeSessions.set(sessionId, {
      connection,
      player,
      isListening: false,
      channelId: voiceChannel.id,
    });

    await interaction.reply(`دخلت لـ Voice Channel ${voiceChannel.name}! تكلم و أنا غادي نجاوبك بالدارجة.`);

    // Start listening
    startListening(sessionId);

    return connection;
  } catch (error) {
    logger.error(`Voice join error: ${error.message}`);
    await interaction.reply('عفوا، ماقدرتش ندخل لـ Voice Channel.');
  }
}

export async function leaveVoiceChannel(interaction) {
  const guildId = interaction.guildId;
  const connection = getVoiceConnection(guildId);

  if (!connection) {
    await interaction.reply('أنا ماشي فـ Voice Channel!');
    return;
  }

  try {
    // Clean up session
    const sessionId = `${guildId}-${connection.joinConfig.channelId}`;
    activeSessions.delete(sessionId);
    
    // Clear conversation history
    clearConversation(interaction.channelId);

    // Destroy connection
    connection.destroy();
    
    await interaction.reply('خرجت من Voice Channel. مع السلامة!');
  } catch (error) {
    logger.error(`Voice leave error: ${error.message}`);
    await interaction.reply('عفوا، ماقدرتش نخرج من Voice Channel.');
  }
}

function startListening(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  const { connection, player, channelId } = session;

  // Set up audio receiver
  const receiver = connection.receiver;
  
  // Listen for audio packets
  receiver.speaking.on('start', (userId) => {
    if (session.isListening) return;
    session.isListening = true;
    
    logger.info(`User ${userId} started speaking`);
    
    // Start collecting audio
    const audioStream = receiver.subscribe(userId, {
      end: {
        behavior: 'afterSilence',
        duration: 5000, // 5 seconds of silence to end
      },
    });

    const chunks = [];
    audioStream.on('data', (chunk) => {
      chunks.push(chunk);
    });

    audioStream.on('end', async () => {
      session.isListening = false;
      
      if (chunks.length === 0) {
        logger.info('No audio data received');
        return;
      }

      try {
        // Convert chunks to buffer
        const audioBuffer = Buffer.concat(chunks);
        
        // Skip if too short (less than 1 second)
        if (audioBuffer.length < 16000) {
          logger.info('Audio too short, skipping');
          return;
        }

        // Process audio
        await processAudio(audioBuffer, sessionId, userId);
      } catch (error) {
        logger.error(`Audio processing error: ${error.message}`);
      }
    });
  });
}

async function processAudio(audioBuffer, sessionId, userId) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  const { player, channelId } = session;

  try {
    // Step 1: Speech to Text
    const text = await speechToText(audioBuffer);
    if (!text || text.trim().length === 0) {
      logger.info('No speech detected');
      return;
    }

    // Step 2: Generate AI response
    const reply = await generateResponse(text, channelId, userId);
    if (!reply) {
      logger.error('Failed to generate response');
      return;
    }

    // Step 3: Text to Speech
    const audioData = await textToSpeech(reply);
    if (!audioData) {
      logger.error('Failed to generate speech');
      return;
    }

    // Step 4: Play audio
    const resource = createAudioResource(audioData, {
      inputType: 'mp3',
    });
    
    player.play(resource);
    await entersState(player, AudioPlayerStatus.Playing, 5000);

    logger.info(`Response played: "${reply}"`);
  } catch (error) {
    logger.error(`Process audio error: ${error.message}`);
  }
}

// Clean up session on disconnect
export function cleanupSession(guildId) {
  const connection = getVoiceConnection(guildId);
  if (connection) {
    const sessionId = `${guildId}-${connection.joinConfig.channelId}`;
    activeSessions.delete(sessionId);
    connection.destroy();
    logger.info(`Cleaned up session for guild ${guildId}`);
  }
}
