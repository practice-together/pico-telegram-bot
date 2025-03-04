// Agent class to interact
// with the Groq API and
// generate code

import { Groq } from 'groq-sdk';

export class CodeGenerationAgent {
    private groq: Groq;
    private codeManager: any;

    constructor(apiKey: string, codeManager: any) {
        this.groq = new Groq({
            apiKey: apiKey
        });
        this.codeManager = codeManager;
    }

    private formatCodeForTelegram(code: string): string {
        const escapedCode = code.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
        return '```python\n' + escapedCode + '\n```';
    }

    async generatePicoCode(userRequest: string): Promise<string> {
        const prompt = `
Context: ${userRequest}

IMPORTANT: The following code is ALREADY RUNNING on the Pico. DO NOT redefine these functions or imports.
DO NOT include this code in your response:

import time
import math
import random
from machine import Pin, PWM

# LEDs are already initialized
leds = [PWM(Pin(i)) for i in range(6, 14)]
for led in leds:
    led.freq(1000)

# Servo is already initialized on GPIO28
servo = PWM(Pin(28))
servo.freq(50)  # 50Hz for servo control

def set_brightness(leds, values):
    for led, value in zip(leds, values):
        led.duty_u16(int(value * 65535))

def set_servo_angle(angle):
    # Convert angle to duty cycle (0-180 degrees)
    min_duty = 1638  # ~2.5% of 65535
    max_duty = 8192  # ~12.5% of 65535
    angle = max(0, min(180, angle))
    duty = min_duty + (max_duty - min_duty) * angle / 180
    servo.duty_u16(int(duty))

YOUR TASK:
1. Create exactly ONE function that controls both LEDs and the servo
2. The function should run for exactly 20 iterations
3. Call your function once at the end of the code
4. DO NOT create multiple patterns or functions
5. DO NOT use while True or infinite loops
6. DO NOT redefine any imports or existing functions
7. Use proper indentation (4 spaces)

Specific instructions based on user request:
- ONLY if the user explicitly mentioned moving the servo (like "move servo to 90 degrees" or "rotate servo"), should you control the servo
- If the user did not explicitly mention the servo, DO NOT include any servo movement code
- For LED commands (like "flash the LEDs", "create a rainbow", etc.), only control the LEDs unless servo is specifically mentioned
- DO NOT include servo control code by default

Example of correct code structure:

# If user only mentioned LEDs (e.g., "flash the LEDs")
def led_pattern(leds, servo):
    for i in range(20):  # Exactly 20 iterations
        # Only control LEDs, don't move the servo
        set_brightness(leds, [...])  # Use existing set_brightness function
        time.sleep(0.1)

# OR if user explicitly mentioned servo (e.g., "move servo to 90 degrees and flash LEDs")
def led_and_servo_pattern(leds, servo):
    for i in range(20):  # Exactly 20 iterations
        # Control LEDs
        set_brightness(leds, [...])
        # ONLY move servo when explicitly requested
        set_servo_angle(90)  # Use existing set_servo_angle function
        time.sleep(0.1)

# Call the function once
led_pattern(leds, servo)  # Or led_and_servo_pattern(leds, servo) if servo was mentioned

Generate a SINGLE pattern function following this exact structure.`;

        try {
            const completion = await this.groq.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: "You are a MicroPython programming assistant. Generate exactly one function that controls the LEDs, and ONLY controls the servo if explicitly requested in the user's command. Only move the servo when the user specifically mentions it. Return your code in ```python ... ``` format only."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                model: "llama-3.3-70b-versatile",
                temperature: 0.1,
                max_tokens: 1024,
                top_p: 1,
                stop: null,
                stream: false
            });

            let generatedCode = completion.choices[0]?.message?.content || '';

            // Remove markdown code block syntax if present
            generatedCode = generatedCode.replace(/```python\n/g, '').replace(/```/g, '').trim();

            // Update the code manager with the clean code
            this.codeManager.updateCode(generatedCode);
            console.log('Code updated in CodeManager');

            // Format the code for Telegram display
            return this.formatCodeForTelegram(generatedCode);
        } catch (error) {
            console.error('Error generating code:', error);
            throw new Error('Failed to generate code. Please try again.');
        }
    }
}