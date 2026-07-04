import OpenAI from 'openai';
import { config } from './config.js';
import { logger } from './utils.js';
import FormData from 'form-data';

const openai = new OpenAI({ apiKey: config.openai.apiKey });

// Conversation history per channel
const conversations = new Map();

// Speech to Text (STT)
export async function speechToText(audioBuffer) {
  try {
    logger.info('Transcribing audio...');
    
    // Create form data for the audio file
    const formData = new FormData();
    formData.append('file', audioBuffer, {
      filename: 'audio.wav',
      contentType: 'audio/wav',
    });
    formData.append('model', 'whisper-1');
    formData.append('language', 'ar');
    formData.append('response_format', 'text');

    // Make the request with form data
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.openai.apiKey}`,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    logger.info(`Transcribed: "${text}"`);
    return text;
  } catch (error) {
    logger.error(`STT Error: ${error.message}`);
    return null;
  }
}

// Generate AI response (LLM)
export async function generateResponse(userMessage, channelId, username) {
  try {
    logger.info(`Generating response for: "${userMessage}"`);
    
    // Initialize conversation for this channel
    if (!conversations.has(channelId)) {
      conversations.set(channelId, []);
    }
    
    const history = conversations.get(channelId);
    
    // System prompt for Darija
    const systemPrompt = `أنت مساعد يتحدث بالدارجة المغربية. رد دائمًا بالدارجة المغربية الطبيعية.
    استخدم لهجة الدارجة المغربية الأصيلة. كن ودودًا ومفيدًا.
    حافظ على ردودك قصيرة وطبيعية (جملتين إلى ثلاث جمل كحد أقصى).
    
    Examples of proper Darija responses:
    - "واش بخير؟ شنو كتدير؟"
    - "مزيان، الله يعافيك!"
    - "شكون قال ليك هاد الشي؟"
    - "ماشي مشكل، أنا هنا باش نعونك."`;

    // Build messages array
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-config.voice.maxTurns),
      { role: 'user', content: userMessage }
    ];

    const response = await openai.chat.completions.create({
      model: config.openai.llmModel,
      messages: messages,
      max_tokens: 150,
      temperature: 0.8,
    });

    const reply = response.choices[0].message.content;
    logger.info(`Generated reply: "${reply}"`);
    
    // Update history
    history.push(
      { role: 'user', content: userMessage },
      { role: 'assistant', content: reply }
    );
    
    // Keep history manageable
    if (history.length > config.voice.maxTurns * 2) {
      history.splice(0, history.length - config.voice.maxTurns * 2);
    }
    
    return reply;
  } catch (error) {
    logger.error(`LLM Error: ${error.message}`);
    return 'عفوا، شي مشكل وقع. عاود حاول من بعد.';
  }
}

// Text to Speech (TTS)
export async function textToSpeech(text) {
  try {
    logger.info(`Converting to speech: "${text}"`);
    
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: config.openai.ttsVoice,
      input: text,
    });

    // Convert to buffer
    const buffer = Buffer.from(await mp3.arrayBuffer());
    logger.info('Speech generated successfully');
    return buffer;
  } catch (error) {
    logger.error(`TTS Error: ${error.message}`);
    return null;
  }
}

// Clear conversation history
export function clearConversation(channelId) {
  if (conversations.has(channelId)) {
    conversations.delete(channelId);
    logger.info(`Cleared conversation for channel ${channelId}`);
  }
}
