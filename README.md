# Reverse Image Prompt Lookup

This project implements a backend service that can analyze AI-generated images and predict the prompts and parameters used to generate them.

## Features

- Image upload endpoint
- CLIP-based image embedding
- FAISS vector similarity search
- Prompt and parameter prediction

## Setup

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Download and prepare the dataset:
- Download DiffusionDB-lite from [https://huggingface.co/datasets/poloclub/diffusiondb](https://huggingface.co/datasets/poloclub/diffusiondb)
- Extract it to a directory
- Update the `dataset_path` in `train_index.py`

4. Create the FAISS index:
```bash
python train_index.py
```

5. Run the server:
```bash
python app.py
```

## API Usage

### Upload Endpoint

```bash
POST /upload
Content-Type: multipart/form-data

Parameters:
- image: File (required) - The image file to analyze

Response:
{
    "prompt": "string",
    "alternates": ["string"],
    "confidence": float,
    "model_guess": "string",
    "cfg_guess": float,
    "steps_guess": integer
}
```

## Next Steps

1. Download and process the DiffusionDB dataset
2. Train the FAISS index
3. Implement the similarity search in the upload endpoint
4. Add more features like model parameter prediction
5. Add rate limiting and error handling 