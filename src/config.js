import dotenv from 'dotenv';
dotenv.config();

export const config = {
  discord: {
    token: process.env.DISCORD_TOKEN,
    prefix: process.env.BOT_PREFIX || '!',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    ttsVoice: process.env.TTS_VOICE || 'alloy',
    llmModel: process.env.LLM_MODEL || 'gpt-4o-mini',
  },
  voice: {
    silenceThreshold: parseInt(process.env.VAD_SILENCE_THRESHOLD) || 1000,
    maxTurns: parseInt(process.env.MAX_CONVERSATION_TURNS) || 10,
  },
  // Validate required env vars
  validate() {
    if (!this.discord.token) throw new Error('DISCORD_TOKEN is required');
    if (!this.openai.apiKey) throw new Error('OPENAI_API_KEY is required');
  }
};
