# genprompt - Uncover AI Image Generation Secrets

A web application that analyzes AI-generated images to reveal the prompts, models, and parameters used to create them.

## Features

- Upload any AI-generated image for analysis
- Identify potential prompts used to create the image
- Determine generation parameters (CFG, steps, sampler, seed)
- Get prompt recommendations for similar looks
- Modern, responsive UI built with Next.js

## Technology Stack

- **Frontend**: Next.js, React, TailwindCSS
- **Backend**: Python Flask API
- **Image Analysis**: CLIP embeddings, FAISS vector similarity search
- **Authentication**: Clerk for user management

## Setup

- These instructions are only a brief explanation of the general setup. If you want to familiarize yourself with this codebase, the most important files are going to be build_faiss_index.py and search.py located in the backend.

### Backend Setup

1. Create a virtual environment:

```bash
cd backend
conda create -n genprompt python=3.10
conda activate genprompt
```

2. Cd into backend and install dependencies:

```bash
pip install -r requirements.txt
```

3. Download and prepare the dataset:

```bash
# Example for how to run download.py to download a small dataset (parts 1-5)
python download.py -i 1 -r 5 -z -c

# Build the FAISS index with downloaded images
python build_faiss_index.py
```

4. Run the backend server:

```bash
python server.py
```

### Frontend Setup

1. Navigate to the frontend directory:

```bash
cd genprompt
```

2. Install dependencies:

```bash
bun install
```

3. Run the development server:

```bash
bun dev
```

## Usage

1. Upload an AI-generated image (JPEG, PNG)
2. The system will analyze the image and display:
   - Top matches with similarity scores
   - Potential prompts used to generate the image
   - Generation parameters (model, CFG, steps, sampler, seed)
   - Prompt recommendations for similar results

## License

This project is licensed under the MIT License - see the LICENSE file for details.
