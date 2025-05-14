import os
import json
import pickle
import random
import pandas as pd
import requests
from PIL import Image
from io import BytesIO
from tqdm import tqdm
import faiss
import numpy as np
import torch
from transformers import CLIPProcessor, CLIPModel
import time
from dotenv import load_dotenv

# Constants
PARQUET_PATH = "data/diffusiondb_full/metadata.parquet"
SAVE_DIR = "data/embedded_subset"
NUM_IMAGES = 10000
CLIP_DIM = 512
os.makedirs(SAVE_DIR, exist_ok=True)
load_dotenv()
HF_TOKEN = os.getenv("HF_TOKEN")

if not HF_TOKEN:
    raise ValueError("Please set the HF_TOKEN environment variable with your Hugging Face token")

HEADERS = {"Authorization": f"Bearer {HF_TOKEN}"}

# Load CLIP
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(device)
processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

def download_image(part_id, image_name):
    url = f"https://huggingface.co/datasets/poloclub/diffusiondb/resolve/main/images/part-{part_id:06d}/{image_name}"

    for attempt in range(5):
        try:
            head = requests.head(url, headers=HEADERS)
            if head.status_code == 404:
                return None
            if head.status_code == 429:
                print("⏳ Rate limited. Waiting...")
                time.sleep(5 * (attempt + 1))
                continue

            response = requests.get(url, headers=HEADERS, timeout=20)
            response.raise_for_status()
            return Image.open(BytesIO(response.content)).convert("RGB")
        except Exception as e:
            print(f"❌ Failed to download {image_name} (attempt {attempt + 1}): {e}")
            time.sleep(2 * (attempt + 1))

    return None


def get_image_embedding(image):
    inputs = processor(images=image, return_tensors="pt").to(device)
    with torch.no_grad():
        features = model.get_image_features(**inputs)
    features = features / features.norm(dim=-1, keepdim=True)
    return features.cpu().numpy()

def main():
    print("📖 Loading full metadata...")
    df = pd.read_parquet(PARQUET_PATH)
    print(f"🧮 Full metadata entries: {len(df)}")

    sampled = df.sample(frac=1, random_state=42).reset_index(drop=True)  # shuffle
    index = faiss.IndexFlatL2(CLIP_DIM)
    metadata = []

    count = 0
    for i, row in tqdm(sampled.iterrows(), total=len(sampled), desc="🔁 Downloading & Embedding"):
        if count >= NUM_IMAGES:
            break

        image = download_image(row["part_id"], row["image_name"])
        if not image:
            continue

        try:
            embedding = get_image_embedding(image)
            index.add(embedding)

            metadata.append({
                "prompt": row.get("prompt", ""),
                "model": row.get("model_id", "unknown"),
                "cfg": float(row.get("guidance_scale", 7.5)),
                "steps": int(row.get("num_inference_steps", 30)),
                "sampler": row.get("scheduler", "unknown"),
                "seed": int(row["seed"]) if pd.notna(row.get("seed")) else None
            })
            count += 1

        except Exception as e:
            print(f"⚠️ Failed to embed image {row['image_name']}: {e}")


    print(f"\n✅ Indexing complete: {index.ntotal} vectors")

    # Save index + metadata
    faiss.write_index(index, os.path.join(SAVE_DIR, "prompt_index.faiss"))
    with open(os.path.join(SAVE_DIR, "prompt_metadata.pkl"), "wb") as f:
        pickle.dump(metadata, f)

    print("📦 Saved FAISS index + metadata")

if __name__ == "__main__":
    main()
