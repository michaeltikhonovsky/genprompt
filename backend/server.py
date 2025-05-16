# server.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import os, io, json
from datetime import datetime

import numpy as np
from PIL import Image
from search import ImageSearcher            

###############################################################################
#  Flask setup
###############################################################################
app = Flask(__name__)
CORS(app)

SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(SCRIPT_DIR, "data", "images")
ALLOWED_EXT   = {"png", "jpg", "jpeg"}
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

###############################################################################
#  Searcher initialisation
###############################################################################
try:
    image_searcher = ImageSearcher(top_k=5)
    print("✅ ImageSearcher initialised")
except Exception as e:
    image_searcher = None
    print(f"❌ ImageSearcher failed to init: {e}")

###############################################################################
#  Small helpers
###############################################################################
def allowed(fname):
    return "." in fname and fname.rsplit(".", 1)[1].lower() in ALLOWED_EXT

def embed_image(img: Image.Image) -> np.ndarray:
    """Public wrapper around searcher’s private helper so we can return vectors."""
    stack, _ = image_searcher._embed_image(img)   # stacked 1536-d
    return stack[0]                               # (1,1536) → (1536,)

###############################################################################
#  Routes
###############################################################################
@app.route("/api/upload", methods=["POST"])
def upload():
    if "image" not in request.files:
        return jsonify(error="No image file provided"), 400

    f = request.files["image"]
    if f.filename == "" or not allowed(f.filename):
        return jsonify(error="Invalid or missing filename"), 400

    try:
        img_bytes = f.read()
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    except Exception as e:
        return jsonify(error=f"Cannot read image: {e}"), 400

    # unique filename
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    fname = f"upload_{ts}.png"
    path  = os.path.join(UPLOAD_FOLDER, fname)
    img.save(path)

    # metadata stub (optional prompt fields from the form)
    meta = {
        fname: {
            "p" : request.form.get("prompt", ""),
            "se": request.form.get("seed",  None),
            "c" : float(request.form.get("cfg",   7.5)),
            "st": int  (request.form.get("steps", 30)),
            "sa": request.form.get("sampler", "unknown")
        }
    }
    with open(f"{path}.json", "w", encoding="utf-8") as fp:
        json.dump(meta, fp)

    # run search
    search_res = image_searcher.search(img) if image_searcher else {}

    return jsonify(
        success=True,
        filename=fname,
        embedding=embed_image(img).tolist(),
        results=search_res
    )

# --------------------------------------------------------------------------- #
#  /api/search — image URL, raw file, or embedding
# --------------------------------------------------------------------------- #
@app.route("/api/search", methods=["POST"])
def query():
    if image_searcher is None:
        return jsonify(error="Search not available"), 503

    # ---------- case 1: embedding provided ----------------------------------
    if request.json and "embedding" in request.json:
        try:
            vec = np.asarray(request.json["embedding"], dtype=np.float32)
            if vec.shape != (1536,):
                raise ValueError("embedding must be length-1536 stacked vector")
            vec /= np.linalg.norm(vec) + 1e-8                     # normalise
            dists, idxs = image_searcher.image_index.search(vec.reshape(1, -1), 5)

            results = []
            for score, idx in zip(dists[0], idxs[0]):
                entry = image_searcher.metadata[idx]
                results.append({
                    "similarity": float(score),      # cosine ∈ [-1,1]
                    **entry
                })
            return jsonify(success=True, results=results)
        except Exception as e:
            return jsonify(error=f"Bad embedding: {e}"), 400

    # ---------- case 2: image URL -------------------------------------------
    if request.json and "image_url" in request.json:
        try:
            import requests
            resp = requests.get(request.json["image_url"])
            img = Image.open(io.BytesIO(resp.content)).convert("RGB")
        except Exception as e:
            return jsonify(error=f"URL fetch failed: {e}"), 400

    # ---------- case 3: posted image file -----------------------------------
    elif "image" in request.files:
        f = request.files["image"]
        if f.filename == "" or not allowed(f.filename):
            return jsonify(error="Invalid or missing filename"), 400
        try:
            img = Image.open(io.BytesIO(f.read())).convert("RGB")
        except Exception as e:
            return jsonify(error=f"Cannot decode image: {e}"), 400
    else:
        return jsonify(error="No query supplied"), 400

    # shared image search branch
    try:
        res = image_searcher.search(img)
        return jsonify(success=True, results=res)
    except Exception as e:
        return jsonify(error=f"Search failed: {e}"), 500

###############################################################################
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
