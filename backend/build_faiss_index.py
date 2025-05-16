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
import json
from concurrent.futures import ThreadPoolExecutor
import gc
from datetime import datetime

# === CONFIG ===
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGES_DIR = os.path.join(SCRIPT_DIR, "data", "images")
SAVE_DIR = os.path.join(SCRIPT_DIR, "data", "embedded_subset")
BATCH_SIZE = 64  # Increased from 16 to 64 - we have plenty of VRAM headroom
CLIP_DIM = 768  # ViT-Large has 768-dimensional embeddings
CACHE_DIR = "E:\\ml_cache\\huggingface"
MAX_WORKERS = 8  # Increased parallel workers for faster image loading
CLIP_MODEL = "openai/clip-vit-large-patch14"  # Better CLIP model

# === MEMORY MANAGEMENT ===
def clear_gpu_memory():
    """Clear GPU memory cache"""
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        gc.collect()

print("\n=== Model Configuration ===")
print(f"🤖 Using CLIP model: {CLIP_MODEL}")
print(f"📊 Embedding dimension: {CLIP_DIM}")
print(f"📦 Batch size: {BATCH_SIZE}")
print(f"🧵 Parallel workers: {MAX_WORKERS}")

os.makedirs(SAVE_DIR, exist_ok=True)
os.makedirs(CACHE_DIR, exist_ok=True)

os.environ["HF_HOME"] = CACHE_DIR
os.environ["TRANSFORMERS_CACHE"] = os.path.join(CACHE_DIR, "transformers")
os.environ["HF_DATASETS_CACHE"] = os.path.join(CACHE_DIR, "datasets")

# === CUDA CHECKS ===
print("\n=== CUDA Diagnostics ===")
print(f"PyTorch version: {torch.__version__}")
print(f"CUDA available: {torch.cuda.is_available()}")
print(f"CUDA version: {torch.version.cuda}")
if torch.cuda.is_available():
    print(f"CUDA device count: {torch.cuda.device_count()}")
    print(f"Current CUDA device: {torch.cuda.current_device()}")
    print(f"CUDA device name: {torch.cuda.get_device_name(0)}")
    print(f"CUDA device capability: {torch.cuda.get_device_capability()}")
else:
    print("⚠️ CUDA is not available. This will run much slower on CPU.")

# === LOAD CLIP ===
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"\n🖥️ Using device: {device}")
if device.type == "cuda":
    print(f"   - GPU: {torch.cuda.get_device_name()}")
    print(f"   - Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f}GB")

print(f"\n📥 Loading {CLIP_MODEL}...")
model = CLIPModel.from_pretrained(CLIP_MODEL, cache_dir=CACHE_DIR).to(device)
processor = CLIPProcessor.from_pretrained(CLIP_MODEL, cache_dir=CACHE_DIR)
print("✅ Model loaded successfully")

def get_image_embeddings(images):
    """Process a batch of images at once"""
    inputs = processor(images=images, return_tensors="pt", padding=True).to(device)
    with torch.no_grad():
        features = model.get_image_features(**inputs)
        features = features / features.norm(dim=-1, keepdim=True)
        features_np = features.cpu().numpy()
    
    # Only clear memory if we're getting close to limit
    if torch.cuda.memory_allocated() > 6 * 1024**3:  # 6GB threshold
        del features
        del inputs
        clear_gpu_memory()
    
    return features_np

def load_image_local(image_name):
    """Load a single image"""
    image_path = os.path.join(IMAGES_DIR, image_name)
    if not os.path.exists(image_path):
        return None
    try:
        return Image.open(image_path).convert("RGB")
    except:
        return None

def process_batch(image_names, all_metadata):
    """Process a batch of images and return their embeddings and metadata"""
    # Load images in parallel
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        images = list(executor.map(load_image_local, image_names))
    
    valid_images = []
    valid_metadata = []
    valid_indices = []
    
    for idx, (image, image_name) in enumerate(zip(images, image_names)):
        if image is not None:
            valid_images.append(image)
            img_meta = all_metadata.get(image_name, {})
            meta = {
                "image_name": image_name,
                "prompt": img_meta.get("p", ""),
                "seed": img_meta.get("se"),
                "cfg": img_meta.get("c", 7.5),
                "steps": img_meta.get("st", 30),
                "sampler": img_meta.get("sa", "unknown"),
            }
            valid_metadata.append(meta)
            valid_indices.append(idx)
    
    if not valid_images:
        return None, [], []
        
    try:
        embeddings = get_image_embeddings(valid_images)
        # Clear memory
        del valid_images
        gc.collect()
        if device.type == "cuda":
            torch.cuda.empty_cache()
        return embeddings, valid_metadata, valid_indices
    except Exception as e:
        print(f"⚠️ Error processing batch: {e}")
        clear_gpu_memory()
        return None, [], []

def load_all_metadata():
    """Load metadata from all JSON files in the images directory"""
    metadata = {}
    json_files = [f for f in os.listdir(IMAGES_DIR) if f.endswith('.json')]
    
    print(f"📊 Found {len(json_files)} JSON metadata files")
    for json_file in tqdm(json_files, desc="Loading metadata files"):
        json_path = os.path.join(IMAGES_DIR, json_file)
        try:
            with open(json_path, 'r') as f:
                part_metadata = json.load(f)
            metadata.update(part_metadata)
        except Exception as e:
            print(f"⚠️ Error loading metadata from {json_path}: {e}")
    return metadata

def main():
    start_time = datetime.now()
    print(f"🕒 Starting index build at {start_time.strftime('%H:%M:%S')}")
    
    # Clear GPU memory before starting
    clear_gpu_memory()
    
    print("📖 Loading metadata from JSON files...")
    all_metadata = load_all_metadata()
    print(f"📊 Loaded metadata for {len(all_metadata)} images")

    # Get list of available images
    available_images = [f for f in os.listdir(IMAGES_DIR) if f.endswith('.png')]
    print(f"📊 Found {len(available_images)} images in {IMAGES_DIR}")

    print(f"✅ Processing all {len(available_images)} available images...")

    index = faiss.IndexFlatL2(CLIP_DIM)
    metadata = []
    batch_start_time = datetime.now()
    
    # Process images in batches
    total_batches = (len(available_images) + BATCH_SIZE - 1) // BATCH_SIZE
    with tqdm(total=len(available_images), desc="🔁 Processing images") as pbar:
        for i in range(0, len(available_images), BATCH_SIZE):
            batch = available_images[i:i + BATCH_SIZE]
            embeddings, batch_metadata, valid_indices = process_batch(batch, all_metadata)
            
            if embeddings is not None and len(embeddings) > 0:
                index.add(embeddings)
                metadata.extend(batch_metadata)
                pbar.update(len(batch_metadata))
            else:
                pbar.update(len(batch))
            
            # Print stats and clear memory less frequently (every 2000 images)
            if (i // BATCH_SIZE) % (2000 // BATCH_SIZE) == 0:
                # Only clear if memory usage is high
                if torch.cuda.memory_allocated() > 6 * 1024**3:
                    clear_gpu_memory()
                
                # Calculate batch processing speed
                batch_duration = datetime.now() - batch_start_time
                batch_images_processed = min(2000, i + len(batch))  # Handle first batch case
                batch_speed = batch_images_processed / batch_duration.total_seconds()
                
                print(f"\n📊 Progress Stats:")
                print(f"   - Processed {i + len(batch)} / {len(available_images)} images")
                print(f"   - Current index size: {index.ntotal} vectors")
                print(f"   - Success rate: {len(metadata) / (i + len(batch)) * 100:.1f}%")
                print(f"   - Processing speed: {batch_speed:.1f} images/sec")
                if device.type == "cuda":
                    print(f"   - GPU Memory: {torch.cuda.memory_allocated() / 1024**3:.1f}GB allocated")
                    print(f"   - GPU Memory Reserved: {torch.cuda.max_memory_reserved() / 1024**3:.1f}GB")
                
                # Reset batch timer
                batch_start_time = datetime.now()

    end_time = datetime.now()
    duration = end_time - start_time
    print(f"\n✅ FAISS index built with {index.ntotal} vectors")
    print(f"⏱️ Total processing time: {duration}")
    print(f"📊 Average time per image: {duration.total_seconds() / len(available_images):.2f} seconds")
    print(f"📊 Overall processing speed: {len(available_images) / duration.total_seconds():.1f} images/sec")

    # Save the index and metadata
    print("\n💾 Saving files to disk...")
    faiss.write_index(index, os.path.join(SAVE_DIR, "prompt_index.faiss"))
    with open(os.path.join(SAVE_DIR, "prompt_metadata.pkl"), "wb") as f:
        pickle.dump(metadata, f)

    print("📦 Index and metadata saved to disk!")
    print(f"📊 Final Statistics:")
    print(f"   - Total images processed: {len(available_images)}")
    print(f"   - Successful embeddings: {index.ntotal}")
    print(f"   - Success rate: {index.ntotal / len(available_images) * 100:.1f}%")
    print(f"   - Total processing time: {duration}")

if __name__ == "__main__":
    main()
