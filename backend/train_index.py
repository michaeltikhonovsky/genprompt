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

def process_dataset(dataset_path, model, processor, batch_size=32):
    """Process the DiffusionDB dataset and create FAISS index."""
    embedding_dim = 512  # CLIP ViT-B/32 embedding dimension
    index = faiss.IndexFlatL2(embedding_dim)
    
    metadata = []
    
    # Assuming dataset_path contains images and a metadata.jsonl file
    with open(os.path.join(dataset_path, 'metadata.jsonl'), 'r') as f:
        for line in tqdm(f, desc="Processing images"):
            data = json.loads(line)
            image_path = os.path.join(dataset_path, data['image_path'])
            
            try:
                image = Image.open(image_path).convert('RGB')
                embedding = get_image_embedding(image)
                
                # Add to FAISS index
                index.add(embedding)
                
                # Store metadata
                metadata.append({
                    'prompt': data['prompt'],
                    'model': data.get('model', 'stable-diffusion-v1-5'),
                    'cfg': data.get('cfg', 7.5),
                    'steps': data.get('steps', 30)
                })
                
            except Exception as e:
                print(f"Error processing {image_path}: {str(e)}")
                continue
    
    # Save the index and metadata
    faiss.write_index(index, 'prompt_index.faiss')
    with open('prompt_metadata.pkl', 'wb') as f:
        pickle.dump(metadata, f)

def main():
    print("Loading CLIP model...")
    model, processor = load_clip_model()
    
    print("Processing dataset...")
    # Use the data directory by default
    dataset_path = os.path.join(os.path.dirname(__file__), 'data')
    if not os.path.exists(dataset_path):
        print(f"Error: Dataset not found at {dataset_path}")
        print("Please run download_dataset.py first to download and prepare the dataset.")
        return
    
    process_dataset(dataset_path, model, processor)
    print("Index creation complete!")

if __name__ == "__main__":
    main() 