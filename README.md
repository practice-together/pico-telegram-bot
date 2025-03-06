# Pico Voice-to-LED LLM powered Controller

A Telegram bot that listens to voice messages, transcribes them to text, and generates MicroPython code to control LEDs and servos on a Raspberry Pi Pico W. This project creates a seamless pipeline from voice commands to physical output.

## Overview

This system allows you to control LED patterns and servo movements on a Raspberry Pi Pico W using voice commands sent through Telegram. For example, you can say "create a rainbow pattern" or "move the servo to 90 degrees and make the LEDs pulse", and the system will generate and deploy the appropriate MicroPython code to your Pico W.

### How It Works

1. A user sends a voice message to the Telegram bot
2. The bot transcribes the voice message to text using Groq's Whisper API
3. The transcribed text is processed by a Groq LLM to generate MicroPython code
4. The Raspberry Pi Pico W periodically checks for new code and executes it
5. LEDs and servos respond to the voice command

## Components

- **Telegram Bot**: Receives voice messages and interfaces with the user
- **Bun Server**: Hosts the API endpoints and manages code generation
- **Code Generation Agent**: Uses Groq LLM to generate MicroPython code
- **Raspberry Pi Pico W**: Controls LEDs and servos based on generated code

## Setup Instructions

### Prerequisites

- Node.js and Bun installed
- FFmpeg for audio conversion
- Telegram Bot Token (from BotFather)
- Groq API Key
- Raspberry Pi Pico W with MicroPython installed
- LEDs connected to GPIO pins 6-13
- Servo connected to GPIO pin 28

### Server Setup

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/pico-telegram-bot.git
   cd pico-telegram-bot
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Create a `.env` file with your credentials:
   ```
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   GROQ_API_KEY=your_groq_api_key
   ```

4. Start the server:
   ```bash
   bun run index.ts
   ```

### Pico W Setup

1. Edit the `main.py` file:
   - Set your WiFi credentials (`WIFI_SSID` and `WIFI_PASSWORD`)
   - Update the `SERVER_URL` to point to your server's IP address

2. Connect your LEDs to GPIO pins 6-13 and your servo to GPIO pin 28

3. Upload `main.py` to your Raspberry Pi Pico W using Thonny or your preferred method

## Usage

1. Start a chat with your Telegram bot

2. Send a voice message (up to 10 seconds) with a command like:
   - "Make a rainbow pattern"
   - "Blink all LEDs quickly"
   - "Move the servo to 45 degrees and fade the LEDs"

3. The bot will transcribe your message, generate code, and send it to your Pico W

4. Your Pico W will execute the new code, controlling the LEDs and/or servo as requested

## Security Note

The bot is configured to only respond to a specific Telegram chat ID for security purposes. You'll need to update the `ALLOWED_CHAT_ID` in `index.ts` with your own Telegram chat ID.

## Files Structure

- `index.ts`: Main server file that handles the Telegram bot and API endpoints
- `agent.ts`: Code generation agent that interfaces with the Groq API
- `main.py`: MicroPython code for the Raspberry Pi Pico W
- `package.json`: Project dependencies

## Customization

### LED Configuration

The LEDs are expected to be connected to GPIO pins 6-13 on the Pico W. If you have a different configuration, update the pin numbers in `main.py`.

### Servo Configuration

The servo is configured to use GPIO pin 28. If you need to use a different pin, update the `servo = PWM(Pin(28))` line in `main.py`.

### Voice Command Patterns

The code generation is optimized for LED patterns and servo movements. You can customize the prompt in `agent.ts` to support additional types of commands or hardware.

## Limitations

- Voice messages must be under 10 seconds
- Generated patterns run for exactly 20 iterations to prevent infinite loops
- Only one function is generated per voice command

## Acknowledgments

- [Telegraf](https://github.com/telegraf/telegraf) for the Telegram bot framework
- [Groq](https://groq.com/) for AI transcription and code generation
- [Raspberry Pi Pico](https://www.raspberrypi.com/products/raspberry-pi-pico/) documentation
