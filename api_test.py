import requests
import time
import hashlib
import json

# --- CONFIGURATION ---
API_URL = 'https://devapi-takumi.mihoyo.com/localization/internalapi/at/resource/match'
SECRET_KEY = "miHuYouqTdx4O6mGk7Met" # !!! REPLACE THIS !!!



# --- DYNAMIC VALUES ---
current_timestamp = int(time.time())
timestamp_str = str(current_timestamp)
string_to_hash = SECRET_KEY + timestamp_str
new_sign = hashlib.md5(string_to_hash.encode('utf-8')).hexdigest()

# --- BODY ---
payload = {
    "dataId": "4052112",
    "project": "hk4e",
    "textId": "AchievementData",
    "srcText": "集齐全套《神霄折戟录》。",
    "srcLang": "CHS",
    "tbAssetIds": [8542],
    "tarLang": "EN",
    "sign": new_sign,
    "timestamp": current_timestamp # Send as number
}

# --- MAKE THE REQUEST ---
try:
    print(f"Timestamp: {current_timestamp}")
    print(f"Sign: {new_sign}")
    print(f"Payload being sent: {json.dumps(payload, indent=2)}")

    response = requests.post(API_URL, json=payload) # using json=payload automatically sets Content-Type to application/json

    print(f"\nStatus Code: {response.status_code}")


    print("\nResponse Body:")
    try:
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    except requests.exceptions.JSONDecodeError:
        print(response.text) # Print as text if not JSON

except requests.exceptions.RequestException as e:
    print(f"An error occurred: {e}")