import torch
import faiss
import numpy as np
import pickle
from PIL import Image
from transformers import CLIPProcessor, CLIPModel
import os

class ImageSearcher:
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        # Load CLIP model and processor
        self.model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(self.device)
        self.processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
        
        # Get the directory where this script is located
        current_dir = os.path.dirname(os.path.abspath(__file__))
        
        # Load FAISS index and metadata from the same directory as this script
        index_path = os.path.join(current_dir, 'prompt_index.faiss')
        metadata_path = os.path.join(current_dir, 'prompt_metadata.pkl')
        
        print(f"\nLoading index from: {index_path}")
        print(f"Loading metadata from: {metadata_path}")
        
        self.index = faiss.read_index(index_path)
        print(f"Index contains {self.index.ntotal} vectors")
        
        with open(metadata_path, 'rb') as f:
            self.metadata = pickle.load(f)
        print(f"Metadata contains {len(self.metadata)} entries")
    
    def get_image_embedding(self, image: Image.Image) -> np.ndarray:
        """Generate CLIP embedding for an input image."""
        inputs = self.processor(images=image, return_tensors="pt").to(self.device)
        
        with torch.no_grad():
            image_features = self.model.get_image_features(**inputs)
        
        # Normalize embedding
        image_features = image_features / image_features.norm(dim=-1, keepdim=True)
        return image_features.cpu().numpy()
    
    def search_similar_images(self, query_image: Image.Image, k: int = 5) -> list:
        """
        Search for k most similar images to the query image.
        Returns list of dictionaries containing similarity scores and metadata.
        """
        # Get embedding for query image
        query_embedding = self.get_image_embedding(query_image)
        print(f"\nQuery embedding shape: {query_embedding.shape}")
        
        # Search the FAISS index
        distances, indices = self.index.search(query_embedding, k)
        print(f"Search returned {len(indices[0])} results")
        print(f"Indices: {indices[0]}")
        print(f"Distances: {distances[0]}")
        
        # Format results
        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx < 0 or idx >= len(self.metadata):
                print(f"Warning: Invalid index {idx} (metadata length: {len(self.metadata)})")
                continue
            results.append({
                'similarity_score': float(1 - dist),  # Convert distance to similarity
                'metadata': self.metadata[idx]
            })
        
        return results

def main():
    # Example usage
    searcher = ImageSearcher()
    
    # Get the directory where this script is located
    current_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Test with a sample image using absolute path
    test_image_path = os.path.join(current_dir, "data", "test_imgs", "1.webp")
    try:
        print(f"\nLoading test image from: {test_image_path}")
        query_image = Image.open(test_image_path).convert('RGB')
        results = searcher.search_similar_images(query_image)
        
        print("\nSearch Results:")
        for i, result in enumerate(results, 1):
            print(f"\nResult {i}:")
            print(f"Similarity Score: {result['similarity_score']:.4f}")
            print(f"Prompt: {result['metadata']['prompt']}")
            print(f"Model: {result['metadata']['model']}")
            print(f"CFG: {result['metadata']['cfg']}")
            print(f"Steps: {result['metadata']['steps']}")
            
    except Exception as e:
        print(f"\nError during search: {str(e)}")
        print(f"Test image path: {test_image_path}")
        print(f"Image exists: {os.path.exists(test_image_path)}")
        raise  # Re-raise the exception to see the full stack trace

if __name__ == "__main__":
    main() 