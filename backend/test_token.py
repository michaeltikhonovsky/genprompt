import requests

# Your token here
TOKEN = "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"

# Test URLs
URLS = [
    "https://huggingface.co/api/whoami",
    "https://huggingface.co/datasets/poloclub/diffusiondb/resolve/main/images/part-000000/00000000.png"
]

headers = {
    "Authorization": f"Bearer {TOKEN}"
}

print(f"\nTesting token: {TOKEN[:4]}...{TOKEN[-4:]}")
print(f"Token length: {len(TOKEN)}")

for url in URLS:
    print(f"\nTesting URL: {url}")
    response = requests.get(url, headers=headers)
    print(f"Status code: {response.status_code}")
    if response.status_code == 200:
        print("✅ Success!")
        if url.endswith("whoami"):
            print(f"User info: {response.json()}")
    else:
        print(f"❌ Failed: {response.text}") 