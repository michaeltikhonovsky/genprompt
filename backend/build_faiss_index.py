import os
import pickle
import gc
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

import faiss
import numpy as np
import torch
from PIL import Image
from tqdm import tqdm
from transformers import CLIPModel, CLIPProcessor
import json

# === CONFIGURATION ===
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGES_DIR = os.path.join(SCRIPT_DIR, "data", "images")
SAVE_DIR = os.path.join(SCRIPT_DIR, "data", "embedded_subset")
CACHE_DIR = os.environ.get("HF_CACHE", "E:/ml_cache/huggingface")

BATCH_SIZE = 64                      # plenty of VRAM head‑room
CLIP_MODEL_ID = "openai/clip-vit-large-patch14"
CLIP_DIM_FINAL = 768                 # native dim from projection layer
CLIP_DIM_COMBINED = CLIP_DIM_FINAL * 2  # stacked mid-layer + final-layer
MAX_WORKERS = 8
MAX_PROMPT_TOKENS = 77               # CLIP text encoder hard limit

os.makedirs(SAVE_DIR, exist_ok=True)
os.makedirs(CACHE_DIR, exist_ok=True)

os.environ["HF_HOME"] = CACHE_DIR
os.environ["TRANSFORMERS_CACHE"] = os.path.join(CACHE_DIR, "transformers")
os.environ["HF_DATASETS_CACHE"] = os.path.join(CACHE_DIR, "datasets")

# === DEVICE ===
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Running on {DEVICE}")

# === LOAD CLIP ===
print(f"Loading {CLIP_MODEL_ID} …")
model: CLIPModel = CLIPModel.from_pretrained(CLIP_MODEL_ID, cache_dir=CACHE_DIR)
model.eval().to(DEVICE)
processor = CLIPProcessor.from_pretrained(CLIP_MODEL_ID, cache_dir=CACHE_DIR)
print("Model loaded ✅")

# ------------------------------------------------------------
#  HELPER FUNCTIONS
# ------------------------------------------------------------

def clear_gpu():
    """Aggressively free GPU memory."""
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    gc.collect()


def _extract_stacked_features(pixel_values: torch.Tensor):
    """Return stacked (final ‖ mid) CLIP visual embeddings, *L2‑normalised*."""
    vision_out = model.vision_model(pixel_values=pixel_values, output_hidden_states=True, return_dict=True)

    # CLS token from final & mid transformer block
    cls_final = vision_out.last_hidden_state[:, 0, :]
    hidden_states = vision_out.hidden_states
    mid_idx = len(hidden_states) // 2
    cls_mid = hidden_states[mid_idx][:, 0, :]

    # layernorm + projection identical to forward() logic
    cls_final = model.vision_model.post_layernorm(cls_final)
    cls_mid = model.vision_model.post_layernorm(cls_mid)

    proj_final = model.visual_projection(cls_final)
    proj_mid = model.visual_projection(cls_mid)

    stacked = torch.cat([proj_final, proj_mid], dim=-1)

    # L2‑normalise
    stacked = stacked / stacked.norm(dim=-1, keepdim=True)
    proj_final = proj_final / proj_final.norm(dim=-1, keepdim=True)

    return stacked, proj_final


def get_image_embeddings(img_list):
    """Compute (stacked, final) embeddings for a list of PIL images."""
    inputs = processor(images=img_list, return_tensors="pt", padding=True).to(DEVICE)
    with torch.no_grad():
        stacked, final_only = _extract_stacked_features(inputs["pixel_values"].to(DEVICE))
    return stacked.cpu().numpy(), final_only.cpu().numpy()


def get_text_embeddings(prompt_list):
    """Encode prompts with CLIP text encoder. Long prompts are **truncated to 77 tokens** to avoid runtime errors."""
    if not prompt_list:
        return np.empty((0, CLIP_DIM_FINAL), dtype=np.float32)

    inputs = processor(text=prompt_list,
                       return_tensors="pt",
                       padding="max_length",
                       truncation=True,
                       max_length=MAX_PROMPT_TOKENS).to(DEVICE)
    with torch.no_grad():
        txt = model.get_text_features(**inputs)
        txt = txt / txt.norm(dim=-1, keepdim=True)
    return txt.cpu().numpy()


def load_image(path: str):
    try:
        return Image.open(path).convert("RGB")
    except Exception:
        return None


def load_metadata() -> dict:
    """Concatenate all *.json files into a single dict keyed by image filename."""
    meta = {}
    json_files = [f for f in os.listdir(IMAGES_DIR) if f.endswith(".json")]
    for jf in tqdm(json_files, desc="Loading JSON metadata"):
        with open(os.path.join(IMAGES_DIR, jf), "r", encoding="utf-8") as fp:
            meta.update(json.load(fp))
    return meta

# ------------------------------------------------------------
#  MAIN PIPELINE
# ------------------------------------------------------------

def main():
    start = datetime.now()
    clear_gpu()

    meta_all = load_metadata()
    print(f"Loaded metadata for {len(meta_all):,} images")

    image_files = [f for f in os.listdir(IMAGES_DIR) if f.lower().endswith((".png", ".jpg", ".jpeg"))]
    print(f"Found {len(image_files):,} image files")

    # two FAISS indexes: images (1536‑d) and prompts (768‑d)
    index_img = faiss.IndexFlatIP(CLIP_DIM_COMBINED)
    index_txt = faiss.IndexFlatIP(CLIP_DIM_FINAL)
    metadata = []

    with tqdm(total=len(image_files), desc="Embedding images") as pbar:
        for i in range(0, len(image_files), BATCH_SIZE):
            batch_files = image_files[i : i + BATCH_SIZE]
            # parallel load
            with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
                imgs = list(ex.map(lambda fn: load_image(os.path.join(IMAGES_DIR, fn)), batch_files))

            valid_imgs, valid_meta = [], []
            for fn, img in zip(batch_files, imgs):
                if img is None:
                    continue
                md = meta_all.get(fn, {})
                valid_imgs.append(img)
                valid_meta.append({
                    "image_name": fn,
                    "prompt": md.get("p", ""),
                    "seed": md.get("se"),
                    "cfg": md.get("c", 7.5),
                    "steps": md.get("st", 30),
                    "sampler": md.get("sa", "unknown"),
                })

            if not valid_imgs:
                pbar.update(len(batch_files))
                continue

            # ---- embeddings ----
            emb_stacked, emb_final = get_image_embeddings(valid_imgs)
            prompt_list = [m["prompt"] for m in valid_meta]
            emb_text = get_text_embeddings(prompt_list)

            # ---- add to indexes ----
            index_img.add(emb_stacked)
            index_txt.add(emb_text)
            metadata.extend(valid_meta)
            pbar.update(len(valid_meta))

            clear_gpu()

    # --- save ---
    faiss.write_index(index_img, os.path.join(SAVE_DIR, "image_index.faiss"))
    faiss.write_index(index_txt, os.path.join(SAVE_DIR, "prompt_index.faiss"))
    with open(os.path.join(SAVE_DIR, "prompt_metadata.pkl"), "wb") as f:
        pickle.dump(metadata, f)

    print("\n✅ All done!")
    print(f"   Images embedded   : {index_img.ntotal:,}")
    print(f"   Runtime           : {datetime.now() - start}")


if __name__ == "__main__":
    main()
