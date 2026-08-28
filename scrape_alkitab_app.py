#!/usr/bin/env python3
"""
Scraper for Lagu Sion songs from https://alkitab.app/LS/{number}
Fetches lyrics, verse structure, and updates all_songs.json, songs/*.json, and index.json.
"""

import os
import re
import sys
import json
import time
import argparse
import urllib.request
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SONGS_DIR = os.path.join(BASE_DIR, "songs")
ALL_SONGS_FILE = os.path.join(BASE_DIR, "all_songs.json")
INDEX_FILE = os.path.join(BASE_DIR, "index.json")

os.makedirs(SONGS_DIR, exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def clean_text(text):
    if not text:
        return ""
    text = text.replace("\xa0", " ").replace("&nbsp;", " ")
    text = text.replace("’", "'").replace("‘", "'").replace("”", '"').replace("“", '"')
    return re.sub(r"[ \t]+", " ", text).strip()

def get_song_list_from_api():
    """Fetches total song list from alkitab.app API if available, else defaults to 1..525."""
    api_url = "https://alkitab.app/songs/api/LS/list"
    req = urllib.request.Request(api_url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            data = json.loads(response.read().decode('utf-8'))
            numbers = []
            for item in data:
                code_str = str(item.get("code", "")).strip()
                if code_str.isdigit():
                    numbers.append(int(code_str))
            if numbers:
                numbers.sort()
                return numbers
    except Exception as e:
        print(f"Warning: Could not fetch song list from API ({e}), defaulting to 1..525")
    return list(range(1, 526))

def fetch_html(url, retries=3):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=12) as response:
                return response.read().decode('utf-8')
        except Exception as e:
            if attempt == retries - 1:
                print(f"Error fetching {url}: {e}")
                return None
            time.sleep(1 + attempt * 1.5)
    return None

def parse_song_page(html_content, num, existing_song=None):
    if not html_content:
        return None

    soup = BeautifulSoup(html_content, 'html.parser')
    lagu_div = soup.find('div', class_='lagu')
    if not lagu_div:
        return None

    # Extract title
    judul_div = lagu_div.find('div', class_='judul')
    title = clean_text(judul_div.get_text()) if judul_div else f"Lagu Sion {num}"
    title = re.sub(r"\\+$", "", title).strip()
    title_full = f"{num:03d} {title}"

    # Extract verses & chorus
    raw_blocks = []
    lirik_div = lagu_div.find('div', class_='lirik')
    if lirik_div:
        for b in lirik_div.find_all('div', class_='bait'):
            classes = b.get('class') or []
            is_chorus = 'reff' in classes

            b_no = b.find('div', class_='bait-no')
            no_text = clean_text(b_no.get_text()) if b_no else None

            lines = []
            for baris in b.find_all('div', class_='baris'):
                line_text = clean_text(baris.get_text())
                if line_text:
                    lines.append(line_text)

            if lines:
                raw_blocks.append({
                    'is_chorus': is_chorus,
                    'no_text': no_text,
                    'lines': lines,
                    'text': '\n'.join(lines)
                })

    # Count normal verses for label (1/N, 2/N, etc.)
    total_normal = sum(1 for b in raw_blocks if not b['is_chorus'])
    if total_normal == 0:
        total_normal = len(raw_blocks)

    verse_idx = 0
    verses = []
    for b in raw_blocks:
        if b['is_chorus']:
            label = "Refrein"
            v_type = "chorus"
        else:
            verse_idx += 1
            label = f"{verse_idx}/{total_normal}"
            v_type = "verse"

        verses.append({
            "label": label,
            "type": v_type,
            "lines": b['lines'],
            "text": b['text']
        })

    # Preserve existing musical metadata (key, time signature, author, youtube)
    time_sig = existing_song.get("time_signature") if existing_song else None
    key_sig = existing_song.get("key") if existing_song else None
    author = existing_song.get("author") if existing_song else None
    youtube_url = existing_song.get("youtube_url") if existing_song else None

    return {
        "number": num,
        "title": title,
        "title_full": title_full,
        "time_signature": time_sig,
        "key": key_sig,
        "author": author,
        "youtube_url": youtube_url,
        "verses": verses,
        "url": f"https://alkitab.app/LS/{num}"
    }

def process_single_song(num, existing_dict):
    url = f"https://alkitab.app/LS/{num}"
    html = fetch_html(url)
    existing_song = existing_dict.get(str(num)) or existing_dict.get(num)
    parsed = parse_song_page(html, num, existing_song)
    return num, parsed

def main():
    parser = argparse.ArgumentParser(description="Scrape Lagu Sion from alkitab.app")
    parser.add_argument("--start", type=int, default=None, help="Start song number")
    parser.add_argument("--end", type=int, default=None, help="End song number")
    parser.add_argument("--song", type=int, default=None, help="Single song number")
    parser.add_argument("--workers", type=int, default=12, help="Number of concurrent workers")
    args = parser.parse_args()

    # Load existing all_songs.json
    existing_dict = {}
    if os.path.exists(ALL_SONGS_FILE):
        try:
            with open(ALL_SONGS_FILE, "r", encoding="utf-8") as f:
                existing_dict = json.load(f)
        except Exception as e:
            print(f"Warning: Could not read existing all_songs.json ({e})")

    # Determine song numbers to fetch
    if args.song:
        song_numbers = [args.song]
    elif args.start and args.end:
        song_numbers = list(range(args.start, args.end + 1))
    else:
        print("Fetching song list from alkitab.app...")
        song_numbers = get_song_list_from_api()

    print(f"Starting scrape for {len(song_numbers)} songs from https://alkitab.app/LS/... using {args.workers} workers")

    updated_count = 0
    failed_songs = []

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {executor.submit(process_single_song, num, existing_dict): num for num in song_numbers}
        for future in as_completed(futures):
            num = futures[future]
            try:
                num, song_data = future.result()
                if song_data and song_data.get("verses"):
                    # Save individual song file
                    song_path = os.path.join(SONGS_DIR, f"{num}.json")
                    with open(song_path, "w", encoding="utf-8") as f:
                        json.dump(song_data, f, indent=2, ensure_ascii=False)

                    # Update master dictionary
                    existing_dict[str(num)] = song_data
                    updated_count += 1
                    print(f"[{updated_count}/{len(song_numbers)}] Updated LS {num}: {song_data['title']} ({len(song_data['verses'])} verses)")
                else:
                    print(f"Failed to parse song {num}")
                    failed_songs.append(num)
            except Exception as e:
                print(f"Exception on song {num}: {e}")
                failed_songs.append(num)

    # Save updated all_songs.json
    # Sort dictionary keys numerically
    sorted_dict = {str(k): existing_dict[str(k)] for k in sorted([int(k) for k in existing_dict.keys()])}
    with open(ALL_SONGS_FILE, "w", encoding="utf-8") as f:
        json.dump(sorted_dict, f, indent=2, ensure_ascii=False)
    print(f"\nSaved {len(sorted_dict)} songs to {ALL_SONGS_FILE}")

    # Generate index.json
    index_list = []
    for k, s in sorted_dict.items():
        index_list.append({
            "number": s["number"],
            "title": s["title"],
            "title_full": s["title_full"],
            "file": f"songs/{s['number']}.json"
        })

    with open(INDEX_FILE, "w", encoding="utf-8") as f:
        json.dump(index_list, f, indent=2, ensure_ascii=False)
    print(f"Saved {len(index_list)} songs index to {INDEX_FILE}")

    if failed_songs:
        print(f"\nWarning: {len(failed_songs)} songs failed to scrape: {failed_songs}")
    else:
        print(f"\nAll {updated_count} songs successfully fetched and updated from alkitab.app!")

if __name__ == "__main__":
    main()
