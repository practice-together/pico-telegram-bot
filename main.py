# Micropython code for the Raspberrypi Pico W board
import network
import urequests
import time
import json
from machine import Pin, PWM
import math

# Configuration
WIFI_SSID = 'YOUR_WIFI_SSID'
WIFI_PASSWORD = 'YOUR_WIFI_PASSWORD'
SERVER_URL = 'http://192.168.1.221:3000'  # Replace with your server IP
POLL_INTERVAL = 2  # seconds between version checks

# Initialize WiFi
def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    wlan.connect(WIFI_SSID, WIFI_PASSWORD)

    # Wait for connection
    max_wait = 10
    while max_wait > 0:
        if wlan.status() < 0 or wlan.status() >= 3:
            break
        max_wait -= 1
        print('Waiting for connection...')
        time.sleep(1)

    if wlan.status() != 3:
        raise RuntimeError('Network connection failed')
    else:
        print('Connected')
        status = wlan.ifconfig()
        print('IP:', status[0])

# Initialize LEDs
leds = [PWM(Pin(i)) for i in range(6, 14)]
for led in leds:
    led.freq(1000)
    led.duty_u16(0)  # Turn off all LEDs initially

# Initialize Servo on GPIO28
servo = PWM(Pin(28))
servo.freq(50)  # Standard 50Hz frequency for servos
servo.duty_u16(0)  # Initialize at 0 position

def set_brightness(leds, values):
    """Set LED brightness values"""
    for led, value in zip(leds, values):
        led.duty_u16(int(value * 65535))

def set_servo_angle(angle):
    """Set servo position to specified angle (0-180 degrees)"""
    # Convert angle to duty cycle
    # Typically servos use pulses between 1ms (0°) and 2ms (180°)
    # In a 50Hz signal, that's between ~5% and ~10% duty cycle
    min_duty = 1638  # ~2.5% of 65535
    max_duty = 8192  # ~12.5% of 65535
    
    # Ensure angle is within bounds
    angle = max(0, min(180, angle))
    
    # Calculate duty cycle
    duty = min_duty + (max_duty - min_duty) * angle / 180
    servo.duty_u16(int(duty))
    print(f"Setting servo to {angle} degrees")

def check_version():
    """Check the latest code version from the server"""
    try:
        response = urequests.get(f'{SERVER_URL}/api/latestVersion')
        if response.status_code == 200:
            data = json.loads(response.text)
            return data.get('version', 0)
        return None
    except Exception as e:
        print('Error checking version:', e)
        return None
    finally:
        try:
            response.close()
        except:
            pass

def fetch_and_execute_code():
    """Fetch and execute the latest code from the server"""
    try:
        response = urequests.get(f'{SERVER_URL}/api/picoCode')
        if response.status_code == 200:
            code = response.text
            print('Executing new code...')
            # Create a new namespace for the code
            namespace = {
                'leds': leds,
                'servo': servo,
                'set_brightness': set_brightness,
                'set_servo_angle': set_servo_angle,
                'time': time,
                'random': __import__('random'),
                'math': math
            }
            try:
                exec(code, namespace)
                print('Code executed successfully')
            except Exception as e:
                print('Error executing code:', e)
    except Exception as e:
        print('Error fetching code:', e)
    finally:
        try:
            response.close()
        except:
            pass

def main():
    print('Connecting to WiFi...')
    connect_wifi()
    
    current_version = -1  # Start with version -1 to force initial code fetch
    
    while True:
        try:
            latest_version = check_version()
            if latest_version is not None and latest_version > current_version:
                print(f'New version available: {latest_version}')
                fetch_and_execute_code()
                current_version = latest_version
            time.sleep(POLL_INTERVAL)
        except Exception as e:
            print('Error in main loop:', e)
            time.sleep(POLL_INTERVAL)

if __name__ == '__main__':
    main()
