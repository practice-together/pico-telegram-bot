import network
import urequests
import time
import json
from machine import Pin, PWM
import math

# Configuration
WIFI_SSID = '#YOUR_WIFI_SSID'
WIFI_PASSWORD = '#YOUR_WIFI_PASSWORD'
SERVER_URL = 'http://192.168.1.156:3000'  # Replace with your server IP
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

def set_brightness(leds, values):
    """Set LED brightness values"""
    for led, value in zip(leds, values):
        led.duty_u16(int(value * 65535))

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
                'set_brightness': set_brightness,
                'time': time,
                'random': __import__('random'),
                'math': __import__('math')
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