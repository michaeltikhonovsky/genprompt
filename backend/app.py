from flask import Flask, request, jsonify
import torch
from PIL import Image
from transformers import CLIPProcessor, CLIPModel
import faiss
import numpy as np
import os
from io import BytesIO

app = Flask(__name__)

# Initialize CLIP model and processor
model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

# Initialize FAISS index (we'll populate this later)
embedding_dim = 512  # CLIP ViT-B/32 embedding dimension
index = faiss.IndexFlatL2(embedding_dim)

# Sample prompts database (to be replaced with actual database)
prompts_db = []

def get_image_embedding(image):
    """Get CLIP embedding for an image."""
    inputs = processor(images=image, return_tensors="pt", padding=True)
    image_features = model.get_image_features(**inputs)
    # Normalize the features
    image_features = image_features / image_features.norm(dim=-1, keepdim=True)
    return image_features.detach().numpy()

@app.route('/upload', methods=['POST'])
def upload_image():
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400
    
    file = request.files['image']
    
    try:
        # Read and process the image
        image_data = file.read()
        image = Image.open(BytesIO(image_data)).convert('RGB')
        
        # Get image embedding
        embedding = get_image_embedding(image)
        
        # Search for similar prompts (placeholder for now)
        # We'll implement the actual search later
        response = {
            "prompt": "a majestic lion in a digital oil painting style",
            "alternates": [
                "a fantasy lion portrait in baroque oil painting",
                "epic lion, trending on ArtStation, golden lighting"
            ],
            "confidence": 0.89,
            "model_guess": "stable-diffusion-v1-5",
            "cfg_guess": 7.5,
            "steps_guess": 30
        }
        
        return jsonify(response)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True) 