import os
import re
import json
import time
import requests
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed

INDEX_URL = "https://lagusiononline.blogspot.com/p/lagu-sion.html"
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
SONGS_DIR = os.path.join(OUTPUT_DIR, "songs")

os.makedirs(SONGS_DIR, exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def clean_text(text):
    if not text:
        return ""
    text = text.replace("\xa0", " ")
    text = text.replace("&nbsp;", " ")
    text = text.replace("’", "'").replace("‘", "'").replace("”", '"').replace("“", '"')
    return re.sub(r"[ \t]+", " ", text).strip()

def get_index_links():
    print(f"Fetching index from {INDEX_URL}...")
    resp = requests.get(INDEX_URL, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    body = soup.find("div", class_="post-body")
    if not body:
        raise ValueError("Could not find post-body on index page")
    
    links = {}
    for a in body.find_all("a", href=True):
        txt = clean_text(a.get_text())
        if re.match(r"^\d{1,3}$", txt):
            num = int(txt)
            href = a["href"]
            if href.startswith("http:"):
                href = "https:" + href[5:]
            links[num] = href
    print(f"Found {len(links)} song links in index.")
    return links

def parse_song_page(html_content, num, url):
    soup = BeautifulSoup(html_content, "html.parser")
    h3 = soup.find("h3", class_="post-title")
    h3_title = clean_text(h3.get_text()) if h3 else ""
    
    body = soup.find("div", class_="post-body")
    if not body:
        return None
        
    iframe = body.find("iframe")
    youtube_url = iframe["src"] if (iframe and "src" in iframe.attrs) else None
    
    # Process text lines
    for tag in body.find_all(["br", "p", "div", "tr", "li"]):
        tag.insert_before("\n")
        tag.insert_after("\n")
        
    raw_lines = [clean_text(line) for line in body.get_text().split("\n")]
    
    # Filter noise
    lines = []
    for l in raw_lines:
        if not l:
            continue
        if l.upper() in ["BATAK", "ENGLISH", "DOWNLOAD", "PDF"]:
            continue
        if any(l.startswith(p) for p in ["Diposting oleh", "Kirimkan Ini", "BlogThis!", "Berbagi ke", "Bagikan ke", "Labels:", "Label:"]):
            break
        lines.append(l)
        
    # Extract clean title
    clean_title = re.sub(r"^\d+\s*[-.]?\s*", "", h3_title).strip()
    
    # Parse header metadata vs verses
    time_sig = None
    key_sig = None
    orig_title = None
    author_lines = []
    verse_blocks = []
    
    i = 0
    # Read header elements
    while i < len(lines):
        line = lines[i]
        
        # Check time signature e.g. 4/4, 3/4, 6/8, 2/4, 3/8, 6/4, 9/8, 12/8, 2/2
        if not time_sig and re.match(r"^[1-9]\d*/[1-9]\d*$", line):
            if i < 3:
                time_sig = line
                i += 1
                continue
                
        # Check key signature e.g. 2#=D, 3b=Eb, 1# = G, C, F, G, Bes=Bb, Do=F, 1b=F
        if not key_sig and re.match(r"^(\d+[#b]\s*[-=]\s*[A-Ga-g][#b]?|[A-Ga-g][#b]?(\s*(mayor|minor))?|DO\s*=\s*[A-Ga-g][#b]?|1[#b]\s*=\s*[A-Ga-g][#b]?)$", line, re.IGNORECASE):
            if i < 4:
                key_sig = line
                i += 1
                continue
                
        # Check if line repeats title
        if re.sub(r"^\d+\s*[-.]?\s*", "", line).strip().upper() == clean_title.upper():
            i += 1
            continue
            
        # Check if line is start of verse
        if re.match(r"^(\d+/\d+|\d+\.|\d+|Bait\s+\d+|Ref(rein|rain)?\s*:?|Koor\s*:?|Chorus\s*:?)$", line, re.IGNORECASE):
            break
            
        # Could be original title or author
        if i < 5 and not verse_blocks:
            if re.search(r"\(\s*\d{4}\s*[-–]\s*\d{4}\s*\)", line) or " d." in line or "arr." in line.lower():
                author_lines.append(line)
            elif not orig_title and re.search(r"[A-Za-z]", line):
                orig_title = line
        i += 1
        
    # Parse verses
    curr_label = ""
    curr_type = "verse"
    curr_lines = []
    
    while i < len(lines):
        line = lines[i]
        
        v_match = re.match(r"^(\d+/\d+|Bait\s+\d+|\d+\.|\d+)$", line, re.IGNORECASE)
        ref_match = re.match(r"^(Ref(rein|rain)?\s*:?|Koor\s*:?|Chorus\s*:?)$", line, re.IGNORECASE)
        
        if v_match or ref_match:
            if curr_lines:
                verse_blocks.append({
                    "label": curr_label or f"Bait {len(verse_blocks)+1}",
                    "type": curr_type,
                    "lines": curr_lines,
                    "text": "\n".join(curr_lines)
                })
                curr_lines = []
            if v_match:
                curr_label = line
                curr_type = "verse"
            else:
                curr_label = "Refrein"
                curr_type = "chorus"
        else:
            if line.upper().startswith("REF:") or line.upper().startswith("KOOR:"):
                if curr_lines:
                    verse_blocks.append({
                        "label": curr_label or f"Bait {len(verse_blocks)+1}",
                        "type": curr_type,
                        "lines": curr_lines,
                        "text": "\n".join(curr_lines)
                    })
                    curr_lines = []
                curr_label = "Refrein"
                curr_type = "chorus"
                rest = line.split(":", 1)[1].strip()
                if rest:
                    curr_lines.append(rest)
            else:
                curr_lines.append(line)
        i += 1
        
    if curr_lines:
        verse_blocks.append({
            "label": curr_label or f"Bait {len(verse_blocks)+1}",
            "type": curr_type,
            "lines": curr_lines,
            "text": "\n".join(curr_lines)
        })
        
    final_title = clean_title or h3_title or f"Lagu Sion {num}"
    
    return {
        "number": num,
        "title": final_title,
        "title_full": f"{num:03d} {final_title}",
        "time_signature": time_sig,
        "key": key_sig,
        "original_title": orig_title,
        "author": " / ".join(author_lines) if author_lines else None,
        "youtube_url": youtube_url,
        "verses": verse_blocks,
        "url": url
    }

def fetch_and_save_song(num, url, retries=3):
    for attempt in range(retries):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=12)
            if resp.status_code == 200:
                data = parse_song_page(resp.text, num, url)
                if data and data.get("verses"):
                    return data
                elif data:
                    print(f"Warning: Song {num} parsed with 0 verses.")
                    return data
            print(f"Song {num} attempt {attempt+1} got status {resp.status_code}")
        except Exception as e:
            print(f"Song {num} attempt {attempt+1} error: {e}")
        time.sleep(1)
    return None

def main():
    links = get_index_links()
    total = len(links)
    print(f"Starting crawler for {total} songs...")
    
    songs_data = {}
    
    with ThreadPoolExecutor(max_workers=12) as executor:
        future_to_num = {
            executor.submit(fetch_and_save_song, num, url): num
            for num, url in sorted(links.items())
        }
        
        completed = 0
        for future in as_completed(future_to_num):
            num = future_to_num[future]
            try:
                data = future.result()
                if data:
                    songs_data[num] = data
                else:
                    print(f"FAILED to fetch song {num}")
            except Exception as exc:
                print(f"Song {num} generated an exception: {exc}")
            completed += 1
            if completed % 25 == 0 or completed == total:
                print(f"Progress: {completed}/{total} songs crawled...")

    print(f"\nCrawling complete. Successfully collected {len(songs_data)}/{total} songs.")
    
    # Save individual song files (in songs/ and root) and index.json
    index_list = []
    
    for num in sorted(songs_data.keys()):
        song = songs_data[num]
        
        # Save in songs/ folder
        song_path_sub = os.path.join(SONGS_DIR, f"{num}.json")
        with open(song_path_sub, "w", encoding="utf-8") as f:
            json.dump(song, f, ensure_ascii=False, indent=2)
            
        # Save in root as requested ({num}.json)
        song_path_root = os.path.join(OUTPUT_DIR, f"{num}.json")
        with open(song_path_root, "w", encoding="utf-8") as f:
            json.dump(song, f, ensure_ascii=False, indent=2)
            
        index_list.append({
            "number": song["number"],
            "title": song["title"],
            "title_full": song["title_full"],
            "key": song["key"],
            "time_signature": song["time_signature"],
            "verse_count": len(song["verses"]),
            "file": f"{num}.json"
        })
        
    # Write index.json
    index_path = os.path.join(OUTPUT_DIR, "index.json")
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(index_list, f, ensure_ascii=False, indent=2)
    print(f"Saved index to {index_path} with {len(index_list)} items.")
    
    # Write all_songs.json and songs_data.js for standalone offline viewing
    all_songs_path = os.path.join(OUTPUT_DIR, "all_songs.json")
    with open(all_songs_path, "w", encoding="utf-8") as f:
        json.dump(songs_data, f, ensure_ascii=False, indent=2)
        
    js_path = os.path.join(OUTPUT_DIR, "songs_data.js")
    with open(js_path, "w", encoding="utf-8") as f:
        f.write("window.LAGU_SION_DATA = " + json.dumps(songs_data, ensure_ascii=False) + ";\n")
        f.write("window.LAGU_SION_INDEX = " + json.dumps(index_list, ensure_ascii=False) + ";\n")
    print(f"Saved standalone data to {js_path} and {all_songs_path}.")

if __name__ == "__main__":
    main()

