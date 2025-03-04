// Bun server for Telegram bot and Pico code communication
import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import fs from 'fs';
import { Groq } from 'groq-sdk';
import https from 'https';
import { unlink } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { CodeGenerationAgent } from './agent';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const execAsync = promisify(exec);

// Initialize environment variables
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const TEMP_DIR = '/tmp';
const ALLOWED_CHAT_ID = 5374856972; // Authorized chat ID

// Code Manager for handling Pico code versions
class CodeManager {
    private currentVersion: number;
    private currentCode: string;

    constructor() {
        this.currentVersion = 0;
        this.currentCode = '';
    }

    updateCode(newCode: string) {
        this.currentCode = newCode;
        this.currentVersion++;
        console.log(`Updated code to version ${this.currentVersion}`);
    }

    getCurrentVersion(): number {
        return this.currentVersion;
    }

    getCurrentCode(): string {
        return this.currentCode;
    }
}

// Initialize bot, Groq client, code generation agent, and code manager
const bot = new Telegraf(BOT_TOKEN);
const groq = new Groq({ apiKey: GROQ_API_KEY });
const codeManager = new CodeManager();
const codeAgent = new CodeGenerationAgent(GROQ_API_KEY, codeManager);

// Validate required environment variables
if (!BOT_TOKEN || !GROQ_API_KEY) {
    console.error('Please set TELEGRAM_BOT_TOKEN and GROQ_API_KEY in your .env file');
    process.exit(1);
}

// Handle /start command
bot.command('start', async (ctx) => {
    const chatId = ctx.chat.id;
    console.log(`New user started bot. Chat ID: ${chatId}`);

    await ctx.reply(
        'Welcome to Voice-to-Text Bot! 🎙️\n\n' +
        'Send me a voice message (up to 10 seconds), and I\'ll convert it to text and generate LED and servo code for the Pico.\n\n' +
        'You can say things like "create a rainbow pattern" or "move the servo to 90 degrees".\n\n' +
        'Note: Please speak clearly for better results.'
    );
});

// Download voice message
async function downloadVoiceMessage(fileUrl: string, localPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        https.get(fileUrl, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }
            const writeStream = fs.createWriteStream(localPath);
            response.pipe(writeStream);
            writeStream.on('finish', () => resolve());
            writeStream.on('error', (error: Error) => reject(error));
        }).on('error', (error: Error) => reject(error));
    });
}

// Convert OGG to compressed MP3 using FFmpeg
async function convertOggToMp3(inputPath: string, outputPath: string): Promise<void> {
    await execAsync(`ffmpeg -i ${inputPath} -acodec libmp3lame -ac 1 -b:a 32k ${outputPath}`);
}

// Handle voice messages
bot.on(message('voice'), async (ctx) => {
    const chatId = ctx.chat.id;
    console.log(`Processing voice message from Chat ID: ${chatId}`);

    // Only process messages from authorized chat ID
    if (chatId !== ALLOWED_CHAT_ID) {
        console.log(`Unauthorized chat ID: ${chatId}. Ignoring message.`);
        return;
    }

    try {
        // Check voice message duration
        if (ctx.message.voice.duration > 10) {
            await ctx.reply('Sorry, voice messages must be under 10 seconds long.');
            return;
        }

        await ctx.reply('Processing your voice message...');

        // Get voice file link
        const file = await ctx.telegram.getFile(ctx.message.voice.file_id);
        const voiceUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

        // Generate temporary filenames
        const tempId = Math.random().toString(36).substring(7);
        const oggPath = path.join(TEMP_DIR, `voice_${tempId}.ogg`);
        const mp3Path = path.join(TEMP_DIR, `voice_${tempId}.mp3`);

        console.log(`Chat ID ${chatId}: Downloading voice message...`);
        await downloadVoiceMessage(voiceUrl, oggPath);

        console.log(`Chat ID ${chatId}: Converting to MP3...`);
        await convertOggToMp3(oggPath, mp3Path);

        // Check file size
        const stats = await fs.promises.stat(mp3Path);
        if (stats.size > 25 * 1024 * 1024) {
            throw new Error('Audio file too large. Please send a shorter message.');
        }

        console.log(`Chat ID ${chatId}: Sending to Groq API...`);
        const transcription = await groq.audio.transcriptions.create({
            file: fs.createReadStream(mp3Path),
            model: "whisper-large-v3-turbo",
            response_format: "json",
            language: "en",
            temperature: 0.0
        });

        console.log(`Chat ID ${chatId}: Transcription received`);
        await ctx.reply(`Transcription: ${transcription.text}`);

        // Generate code based on transcription
        console.log(`Chat ID ${chatId}: Generating code...`);
        const code = await codeAgent.generatePicoCode(transcription.text);
        await ctx.reply(code, { parse_mode: 'MarkdownV2' });

        // Clean up temporary files
        await unlink(oggPath);
        await unlink(mp3Path);
        console.log(`Chat ID ${chatId}: Processing complete`);

    } catch (error) {
        console.error(`Error processing voice message from Chat ID ${chatId}:`, error);

        if (error.message.includes('too large')) {
            await ctx.reply('Sorry, the voice message is too large. Please send a shorter message.');
        } else if (error.message.includes('invalid_request_error')) {
            await ctx.reply('Sorry, there was an error with the transcription service. Please try again with a clearer audio message.');
        } else {
            await ctx.reply('Sorry, there was an error processing your voice message. Please try again.');
        }
    }
});

// Create HTTP server for Pico communication
const server = Bun.serve({
    port: 3000,
    async fetch(req) {
        const url = new URL(req.url);

        // Handle version check endpoint
        if (url.pathname === '/api/latestVersion') {
            return new Response(JSON.stringify({
                version: codeManager.getCurrentVersion()
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

        // Handle code fetch endpoint
        if (url.pathname === '/api/picoCode') {
            return new Response(codeManager.getCurrentCode(), {
                headers: {
                    'Content-Type': 'text/plain',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

        // Handle other routes
        return new Response('Not Found', { status: 404 });
    }
});

console.log(`Server running at http://localhost:${server.port}`);

// Start Telegram bot
bot.launch().then(() => {
    console.log('Telegram bot is running...');
}).catch((error) => {
    console.error('Error starting bot:', error);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));