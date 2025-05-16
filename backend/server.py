from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from PIL import Image
import io
import torch
from transformers import CLIPProcessor, CLIPModel
import numpy as np
from datetime import datetime
import json
from search import ImageSearcher

app = Flask(__name__)
CORS(app)

# Configuration
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(SCRIPT_DIR, "data", "images")
CACHE_DIR = "E:\\ml_cache\\huggingface"
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}

# Ensure upload directory exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Load CLIP model (reusing from build_faiss_index.py)
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = CLIPModel.from_pretrained("openai/clip-vit-large-patch14", cache_dir=CACHE_DIR).to(device)
processor = CLIPProcessor.from_pretrained("openai/clip-vit-large-patch14", cache_dir=CACHE_DIR)

# Initialize image searcher
image_searcher = None
try:
    image_searcher = ImageSearcher()
    print("✅ ImageSearcher initialized successfully")
except Exception as e:
    print(f"❌ Error initializing ImageSearcher: {str(e)}")

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_image_embedding(image):
    """Get CLIP embedding for a single image"""
    inputs = processor(images=image, return_tensors="pt", padding=True).to(device)
    with torch.no_grad():
        features = model.get_image_features(**inputs)
        features = features / features.norm(dim=-1, keepdim=True)
        features_np = features.cpu().numpy()
    return features_np[0]  # Return the first (and only) embedding

@app.route('/api/upload', methods=['POST'])
def upload_image():
    if 'image' not in request.files:
        return jsonify({'error': 'No image file provided'}), 400
    
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'File type not allowed'}), 400

    try:
        # Read and verify the image
        image_data = file.read()
        image = Image.open(io.BytesIO(image_data)).convert('RGB')
        
        # Generate a unique filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"upload_{timestamp}.png"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        
        # Save the image
        image.save(filepath)
        
        # Get the embedding
        embedding = get_image_embedding(image)
        
        # Save metadata
        metadata = {
            filename: {
                "p": request.form.get('prompt', ''),
                "se": request.form.get('seed', None),
                "c": float(request.form.get('cfg', 7.5)),
                "st": int(request.form.get('steps', 30)),
                "sa": request.form.get('sampler', 'unknown')
            }
        }
        
        metadata_file = os.path.join(UPLOAD_FOLDER, f"{filename}.json")
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f)
        
        # Find similar images if searcher is available
        similar_images = []
        if image_searcher:
            try:
                results = image_searcher.search_similar_images(image, k=5)
                similar_images = results
            except Exception as e:
                print(f"Error during image search: {str(e)}")
        
        return jsonify({
            'success': True,
            'filename': filename,
            'embedding': embedding.tolist(),
            'similar_images': similar_images
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/search', methods=['POST'])
def search_similar():
    if not image_searcher:
        return jsonify({'error': 'Image search functionality not available'}), 503
    
    # Method 1: Get image from URL in JSON
    if request.json and 'image_url' in request.json:
        try:
            import requests
            response = requests.get(request.json['image_url'])
            image_data = response.content
            image = Image.open(io.BytesIO(image_data)).convert('RGB')
        except Exception as e:
            return jsonify({'error': f'Failed to load image from URL: {str(e)}'}), 400
    
    # Method 2: Accept embedding directly
    elif request.json and 'embedding' in request.json:
        try:
            # Search using the provided embedding
            embedding = np.array(request.json['embedding'], dtype=np.float32).reshape(1, -1)
            distances, indices = image_searcher.index.search(embedding, 5)
            
            results = []
            for dist, idx in zip(distances[0], indices[0]):
                if idx < 0 or idx >= len(image_searcher.metadata):
                    continue
                results.append({
                    'similarity_score': float(1 - dist),
                    'metadata': image_searcher.metadata[idx]
                })
            
            return jsonify({
                'success': True,
                'results': results
            })
        except Exception as e:
            return jsonify({'error': f'Failed to process embedding: {str(e)}'}), 400
    
    # Method 3: Get image from uploaded file
    elif 'image' in request.files:
        file = request.files['image']
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'File type not allowed'}), 400
        
        try:
            image_data = file.read()
            image = Image.open(io.BytesIO(image_data)).convert('RGB')
        except Exception as e:
            return jsonify({'error': f'Failed to process image: {str(e)}'}), 400
    
    else:
        return jsonify({'error': 'No image provided'}), 400
    
    # Search for similar images
    try:
        results = image_searcher.search_similar_images(image, k=5)
        return jsonify({
            'success': True,
            'results': results
        })
    except Exception as e:
        return jsonify({'error': f'Search failed: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True) 