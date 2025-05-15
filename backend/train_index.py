import torch
from transformers import CLIPProcessor, CLIPModel
import faiss
import numpy as np
import json
from PIL import Image
from tqdm import tqdm
import os
import pickle

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(device)
processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

def load_clip_model():
    """Load CLIP model and processor."""
    model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
    processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
    return model, processor

def get_image_embedding(image: Image.Image) -> np.ndarray:
    """Takes a PIL image and returns a normalized CLIP embedding as a NumPy array."""
    # Prepare input for the model
    inputs = processor(images=image, return_tensors="pt").to(device)

    with torch.no_grad():
        image_features = model.get_image_features(**inputs)

    # Normalize (L2 norm)
    image_features = image_features / image_features.norm(dim=-1, keepdim=True)

    # Convert to NumPy array for FAISS
    return image_features.cpu().numpy()

def main():
    print("Loading CLIP model...")
    model, processor = load_clip_model()
    
    print("Loading pre-built index...")
    # Use the data directory from build_faiss_index
    index_path = os.path.join('data', 'embedded_subset', 'prompt_index.faiss')
    metadata_path = os.path.join('data', 'embedded_subset', 'prompt_metadata.pkl')
    
    if not os.path.exists(index_path) or not os.path.exists(metadata_path):
        print(f"Error: Index not found at {index_path}")
        print("Please run build_faiss_index.py first to create the index.")
        return
    
    # Copy files to the expected location for search.py
    index = faiss.read_index(index_path)
    with open(metadata_path, 'rb') as f:
        metadata = pickle.load(f)
    
    # Save to root directory for search.py
    faiss.write_index(index, 'prompt_index.faiss')
    with open('prompt_metadata.pkl', 'wb') as f:
        pickle.dump(metadata, f)
    
    print("Index loading and copying complete!")

if __name__ == "__main__":
    main() 