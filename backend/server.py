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
        
        return jsonify({
            'success': True,
            'filename': filename,
            'embedding': embedding.tolist()
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True) 