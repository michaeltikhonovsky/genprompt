import os
import pickle
import random
import pandas as pd
from PIL import Image
from tqdm import tqdm
import faiss
import numpy as np
import torch
from transformers import CLIPProcessor, CLIPModel

# === CONFIG ===
PARQUET_PATH = "data/diffusiondb_full/metadata.parquet"
IMAGES_DIR = "images"  # where you unzipped part-000000.zip to part-000019.zip
SAVE_DIR = "data/embedded_subset"
NUM_IMAGES = 20000
CLIP_DIM = 512
CACHE_DIR = "E:\\ml_cache\\huggingface"

os.makedirs(SAVE_DIR, exist_ok=True)
os.makedirs(CACHE_DIR, exist_ok=True)

os.environ["HF_HOME"] = CACHE_DIR
os.environ["TRANSFORMERS_CACHE"] = os.path.join(CACHE_DIR, "transformers")
os.environ["HF_DATASETS_CACHE"] = os.path.join(CACHE_DIR, "datasets")

# === LOAD CLIP ===
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32", cache_dir=CACHE_DIR).to(device)
processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32", cache_dir=CACHE_DIR)

def get_image_embedding(image):
    inputs = processor(images=image, return_tensors="pt").to(device)
    with torch.no_grad():
        features = model.get_image_features(**inputs)
    features = features / features.norm(dim=-1, keepdim=True)
    return features.cpu().numpy()

def load_image_local(part_id, image_name):
    part_dir = os.path.join(IMAGES_DIR, f"part-{part_id:06d}")
    image_path = os.path.join(part_dir, image_name)
    if not os.path.exists(image_path):
        return None
    try:
        return Image.open(image_path).convert("RGB")
    except:
        return None

def main():
    print("📖 Loading metadata...")
    df = pd.read_parquet(PARQUET_PATH)

    print(f"📊 Total metadata entries: {len(df)}")

    # Filter metadata to match locally downloaded parts (0–19)
    valid_df = df[
        df["part_id"].between(0, 19) & df["image_name"].notna()
    ].copy()
    valid_df["part_id"] = valid_df["part_id"].astype(int)
    valid_df["image_name"] = valid_df["image_name"].astype(str)

    # Check which images actually exist locally
    print("🔍 Verifying image files exist locally...")
    valid_df["local_exists"] = valid_df.apply(
        lambda row: os.path.exists(
            os.path.join(IMAGES_DIR, f"part-{row['part_id']:06d}", row["image_name"])
        ),
        axis=1,
    )
    valid_df = valid_df[valid_df["local_exists"]].drop(columns=["local_exists"])

    if len(valid_df) < NUM_IMAGES:
        raise ValueError(f"Only {len(valid_df)} valid local images found. Reduce NUM_IMAGES or download more parts.")

    print(f"✅ {len(valid_df)} images available locally. Sampling {NUM_IMAGES}...")

    sampled = valid_df.sample(n=NUM_IMAGES, random_state=42).reset_index(drop=True)

    index = faiss.IndexFlatL2(CLIP_DIM)
    metadata = []

    for _, row in tqdm(sampled.iterrows(), total=len(sampled), desc="🔁 Embedding"):
        image = load_image_local(row["part_id"], row["image_name"])
        if image is None:
            continue

        try:
            embedding = get_image_embedding(image)
            index.add(embedding)

            meta = {
                "image_name": row["image_name"],
                "part_id": row["part_id"],
                "prompt": row.get("prompt", ""),
                "seed": int(row["seed"]) if pd.notna(row.get("seed")) else None,
                "cfg": float(row["cfg"]) if pd.notna(row.get("cfg")) else 7.5,
                "steps": int(row["step"]) if pd.notna(row.get("step")) else 30,
                "sampler": row.get("sampler", "unknown"),
            }

            for key in row.index:
                if key not in meta and pd.notna(row[key]):
                    meta[key] = row[key]

            metadata.append(meta)

        except Exception as e:
            print(f"⚠️ Error embedding image {row['image_name']}: {e}")

    print(f"\n✅ FAISS index built with {index.ntotal} vectors")

    faiss.write_index(index, os.path.join(SAVE_DIR, "prompt_index.faiss"))
    with open(os.path.join(SAVE_DIR, "prompt_metadata.pkl"), "wb") as f:
        pickle.dump(metadata, f)

    print("📦 Index and metadata saved to disk!")

if __name__ == "__main__":
    main()
