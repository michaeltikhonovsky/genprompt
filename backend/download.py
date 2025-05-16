# Author: Marco Lustri 2022 - https://github.com/TheLustriVA
# MIT License

from urllib.error import HTTPError
from urllib.request import urlretrieve
from alive_progress import alive_bar
import shutil
import os
import time
import argparse

# # First download with clearing
# python download.py -i 1 -r 21 -z -c

# Subsequent downloads without clearing
# python download.py -i 100 -r 121 -z
# python download.py -i 500 -r 521 -z

# Constants
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
HARDCODED_OUTPUT_DIR = os.path.join(SCRIPT_DIR, "data", "images")

def clear_directory(directory):
    """Clear all files in the specified directory."""
    if os.path.exists(directory):
        print(f"🗑️ Clearing directory: {directory}")
        for filename in os.listdir(directory):
            file_path = os.path.join(directory, filename)
            try:
                if os.path.isfile(file_path):
                    os.unlink(file_path)
                elif os.path.isdir(file_path):
                    shutil.rmtree(file_path)
            except Exception as e:
                print(f'Failed to delete {file_path}. Reason: {e}')
    else:
        os.makedirs(directory)
    print("✨ Directory cleared successfully")

def download(index=0, range_index=0, large=False, should_clear=False):
    """
    Download zip files from DiffusionDB.
    """
    baseurl = "https://huggingface.co/datasets/poloclub/diffusiondb/resolve/main/"
    files_to_unzip = []

    # Only clear if explicitly requested
    if should_clear:
        clear_directory(HARDCODED_OUTPUT_DIR)
    elif not os.path.exists(HARDCODED_OUTPUT_DIR):
        os.makedirs(HARDCODED_OUTPUT_DIR)

    if range_index == 0:
        # Single file
        url = f"{baseurl}images/part-{index:06}.zip" if not large else (
            f"{baseurl}diffusiondb-large-part-1/part-{index:06}.zip"
            if index <= 10000 else f"{baseurl}diffusiondb-large-part-2/part-{index:06}.zip"
        )
        file_path = os.path.join(HARDCODED_OUTPUT_DIR, f"part-{index:06}.zip")
        print("📥 Downloading:", url)
        try:
            urlretrieve(url, file_path)
            files_to_unzip.append(file_path)
        except HTTPError as e:
            print(f"❌ HTTPError downloading {url}: {e}")
    else:
        # Range of files
        with alive_bar(range_index - index, title="📥 Downloading files") as bar:
            for idx in range(index, range_index):
                url = f"{baseurl}images/part-{idx:06}.zip" if not large else (
                    f"{baseurl}diffusiondb-large-part-1/part-{idx:06}.zip"
                    if idx <= 10000 else f"{baseurl}diffusiondb-large-part-2/part-{idx:06}.zip"
                )
                file_path = os.path.join(HARDCODED_OUTPUT_DIR, f"part-{idx:06}.zip")
                try:
                    urlretrieve(url, file_path)
                    files_to_unzip.append(file_path)
                    manifest_path = os.path.join(HARDCODED_OUTPUT_DIR, "manifest.txt")
                    with open(manifest_path, "a") as f:
                        f.write(url + "\n")
                except HTTPError as e:
                    print(f"❌ HTTPError downloading {url}: {e}")
                time.sleep(0.1)
                bar()

    return files_to_unzip

def unzip_file(file_path):
    try:
        shutil.unpack_archive(file_path, extract_dir=HARDCODED_OUTPUT_DIR)
        # Clean up zip file after successful extraction
        os.remove(file_path)
        return f"✅ Unzipped and cleaned up: {file_path}"
    except Exception as e:
        return f"❌ Failed to unzip {file_path}: {e}"

def unzip_all(file_paths):
    with alive_bar(len(file_paths), title="📦 Unzipping files") as bar:
        for file in file_paths:
            print(unzip_file(file))
            time.sleep(0.1)
            bar()

def main(index=None, range_max=None, unzip=False, large=False, clear=False):
    if index is not None and range_max is not None:
        if range_max - index >= 1999:
            confirmation = input("⚠️ This may require 1.7TB+ space. Continue? (y/n): ")
            if confirmation.lower() != "y":
                return
        files = download(index=index, range_index=range_max, large=large, should_clear=clear)
        if unzip and files:
            unzip_all(files)
    elif index is not None:
        files = download(index=index, large=large, should_clear=clear)
        if unzip and files:
            unzip_all(files)
    else:
        print("❌ No index provided. Use -i to specify the starting index.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download DiffusionDB ZIP files")

    parser.add_argument(
        "-i", "--index", type=int, default=None,
        help="File to download or lower bound of range if -r is set"
    )
    parser.add_argument(
        "-r", "--range", type=int, default=None,
        help="Upper bound of range if -i is provided"
    )
    parser.add_argument(
        "-z", "--unzip", action="store_true",
        help="Unzip the files after downloading"
    )
    parser.add_argument(
        "-l", "--large", action="store_true",
        help="Download from DiffusionDB Large (14 million images)"
    )
    parser.add_argument(
        "-c", "--clear", action="store_true",
        help="Clear the output directory before downloading"
    )

    args = parser.parse_args()

    main(
        index=args.index,
        range_max=args.range,
        unzip=args.unzip,
        large=args.large,
        clear=args.clear
    )
