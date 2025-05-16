import os
import pickle
from typing import List, Dict

import faiss
import numpy as np
import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

# ------------------------------------------------------------------
#  SEARCHER
# ------------------------------------------------------------------

class ImageSearcher:
    """Search both *image→image* and *image→prompt* FAISS indexes."""

    def __init__(self, top_k: int = 5):
        self.top_k = top_k
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        # ---- load CLIP ----
        self.model_id = "openai/clip-vit-large-patch14"
        print(f"Loading CLIP backbone {self.model_id} …")
        self.model: CLIPModel = CLIPModel.from_pretrained(self.model_id).eval().to(self.device)
        self.processor = CLIPProcessor.from_pretrained(self.model_id)

        # ---- load FAISS indexes ----
        base_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "embedded_subset")
        img_index_path = os.path.join(base_dir, "image_index.faiss")
        txt_index_path = os.path.join(base_dir, "prompt_index.faiss")
        meta_path = os.path.join(base_dir, "prompt_metadata.pkl")

        print("Loading FAISS indexes …")
        self.image_index = faiss.read_index(img_index_path)
        self.prompt_index = faiss.read_index(txt_index_path)
        print(f"   image_index  : {self.image_index.ntotal:,} × {self.image_index.d}")
        print(f"   prompt_index : {self.prompt_index.ntotal:,} × {self.prompt_index.d}")

        with open(meta_path, "rb") as fp:
            self.metadata = pickle.load(fp)
        print(f"Loaded {len(self.metadata):,} metadata rows")

        assert self.image_index.ntotal == len(self.metadata) == self.prompt_index.ntotal, "Index / metadata mismatch!"

    # ------------------------------------------------------------------
    #  Embeddings helpers
    # ------------------------------------------------------------------

    def _embed_image(self, pil_img: Image.Image):
        """Return (stacked1536, final768) numpy arrays."""
        inputs = self.processor(images=pil_img, return_tensors="pt").to(self.device)
        with torch.no_grad():
            # vision encoder with hidden states
            vis_out = self.model.vision_model(pixel_values=inputs["pixel_values"], output_hidden_states=True, return_dict=True)
            cls_final = vis_out.last_hidden_state[:, 0, :]
            hidden_states = vis_out.hidden_states
            cls_mid = hidden_states[len(hidden_states)//2][:, 0, :]
            cls_final = self.model.vision_model.post_layernorm(cls_final)
            cls_mid = self.model.vision_model.post_layernorm(cls_mid)
            proj_final = self.model.visual_projection(cls_final)
            proj_mid = self.model.visual_projection(cls_mid)
            final_768 = proj_final / proj_final.norm(dim=-1, keepdim=True)
            stacked_1536 = torch.cat([proj_final, proj_mid], dim=-1)
            stacked_1536 = stacked_1536 / stacked_1536.norm(dim=-1, keepdim=True)
        return stacked_1536.cpu().numpy(), final_768.cpu().numpy()

    # ------------------------------------------------------------------
    #  Public API
    # ------------------------------------------------------------------

    def search(self, img: Image.Image) -> Dict[str, List[Dict]]:
        """Return dict with keys 'image_matches' and 'prompt_matches'."""
        emb_stack, emb_final = self._embed_image(img)

        # ---- image→image ----
        d_img, i_img = self.image_index.search(emb_stack, self.top_k)
        img_matches = self._format_results(d_img[0], i_img[0])

        # ---- image→prompt ----
        d_txt, i_txt = self.prompt_index.search(emb_final, self.top_k)
        prompt_matches = self._format_results(d_txt[0], i_txt[0])

        return {"image_matches": img_matches, "prompt_matches": prompt_matches}

    # ------------------------------------------------------------------

    def _format_results(self, dots: np.ndarray, idxs: np.ndarray) -> List[Dict]:
        """Convert FAISS outputs into friendly dicts."""
        results = []
        for score, idx in zip(dots, idxs):
            if idx < 0 or idx >= len(self.metadata):
                continue
            entry = self.metadata[idx]
            results.append({
                "similarity": float(score),  # cosine in [-1,1]
                "image_name": entry["image_name"],
                "prompt": entry["prompt"],
                "seed": entry["seed"],
                "cfg": entry["cfg"],
                "steps": entry["steps"],
                "sampler": entry["sampler"],
            })
        return results

# ------------------------------------------------------------------
#  DEMO
# ------------------------------------------------------------------

def _demo():
    searcher = ImageSearcher(top_k=5)
    test_img_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "test_imgs", "test-3.jpg")
    if not os.path.exists(test_img_path):
        raise FileNotFoundError(test_img_path)

    with Image.open(test_img_path).convert("RGB") as img:
        res = searcher.search(img)

    # pretty-print with full metadata
    for kind, arr in res.items():
        print(f"\n{'='*20} {kind.upper()} {'='*20}")
        for i, r in enumerate(arr, 1):
            print(f"\nMatch #{i}  (similarity: {r['similarity']:.3f})")
            print(f"Image name: {r['image_name']}")
            print(f"Prompt: {r['prompt']}")
            print(f"Generation settings:")
            print(f"  - Seed: {r['seed']}")
            print(f"  - CFG: {r['cfg']}")
            print(f"  - Steps: {r['steps']}")
            print(f"  - Sampler: {r['sampler']}")
            print('-' * 50)

if __name__ == "__main__":
    _demo()
