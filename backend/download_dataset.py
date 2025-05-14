import os
import json
from datasets import load_dataset
from PIL import Image
from tqdm import tqdm

# Constants
SUBSET_NAME = "2m_first_1k"
SAVE_DIR = os.path.join("data", "diffusiondb_lite")
METADATA_FILE = "metadata.jsonl"

os.makedirs(SAVE_DIR, exist_ok=True)

def download_diffusiondb_subset():
    print(f"🔄 Loading DiffusionDB subset '{SUBSET_NAME}' from Hugging Face...")
    dataset = load_dataset(
    "poloclub/diffusiondb",
    "2m_first_1k",
    split="train",
    download_mode="force_redownload",
    keep_in_memory=True
)

    print(f"✅ Loaded {len(dataset)} samples.")

    metadata_path = os.path.join(SAVE_DIR, METADATA_FILE)
    with open(metadata_path, "w", encoding="utf-8") as meta_file:
        for i, example in enumerate(tqdm(dataset, desc="📥 Downloading images")):
            try:
                image: Image.Image = example["image"]
                image_name = f"{i:04d}.png"
                image_path = os.path.join(SAVE_DIR, image_name)
                image.save(image_path)

                metadata = {
                    "image_path": image_name,
                    "prompt": example.get("prompt", ""),
                    "model": example.get("model_id", "unknown"),
                    "cfg": float(example.get("guidance_scale", 7.5)),
                    "steps": int(example.get("num_inference_steps", 30)),
                    "sampler": example.get("scheduler", "unknown"),
                    "seed": example.get("seed")
                }

                meta_file.write(json.dumps(metadata) + "\n")

            except Exception as e:
                print(f"❌ Failed to process image: {e}")
                continue


    print(f"\n✅ Dataset downloaded successfully!")
    print(f"📁 Images saved in: {SAVE_DIR}")
    print(f"📝 Metadata saved as: {metadata_path}")

if __name__ == "__main__":
    download_diffusiondb_subset()
