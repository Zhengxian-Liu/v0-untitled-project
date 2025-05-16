import requests
import time
import hashlib
import json

# --- CONFIGURATION ---
API_URL = 'https://devapi-takumi.mihoyo.com/localization/internalapi/at/resource/match'
SECRET_KEY = "miHuYouqTdx4O6mGk7Met" # !!! REPLACE THIS !!!

# --- HEADERS (from your working curl) ---
headers = {
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'zh-CN,zh;q=0.9',
    'content-type': 'application/json',
    'origin': 'https://devop.mihoyo.com',
    'priority': 'u=1, i',
    'referer': 'https://devop.mihoyo.com/',
    'sec-ch-ua': '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site'
}

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
    "srcText": "心跳的记忆",
    "srcLang": "CHS",
    "tarLang": "EN",
    "tbAssetIds": [8668],
    "sign": new_sign,
    "timestamp": current_timestamp # Send as number
}

# --- MAKE THE REQUEST ---
try:
    print(f"Timestamp: {current_timestamp}")
    print(f"Sign: {new_sign}")
    print(f"Payload being sent: {json.dumps(payload, indent=2)}")

    response = requests.post(API_URL, headers=headers, json=payload) # using json=payload automatically sets Content-Type to application/json

    print(f"\nStatus Code: {response.status_code}")
    print("Response Headers:")
    for key, value in response.headers.items():
        print(f"  {key}: {value}")

    print("\nResponse Body:")
    try:
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    except requests.exceptions.JSONDecodeError:
        print(response.text) # Print as text if not JSON

except requests.exceptions.RequestException as e:
    print(f"An error occurred: {e}")