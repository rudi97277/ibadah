#!/usr/bin/env python3
"""
Convert data-source.json (lagusion.org API format) into our app's all_songs format.
Saves the result to all_songs_v2.json WITHOUT modifying all_songs.json.
"""

import os
import re
import json
from bs4 import BeautifulSoup

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE = os.path.join(BASE_DIR, "data-source.json")
OUTPUT_FILE = os.path.join(BASE_DIR, "all_songs_v2.json")

def clean_html_text(raw_html):
    if not raw_html:
        return ""
    text = BeautifulSoup(raw_html, "html.parser").get_text("\n")
    return text

def parse_additional_info(info_html):
    if not info_html:
        return {
            "english_title": None,
            "composer": None,
            "arranger": None,
            "key_sig": None,
            "time_sig": None,
            "scripture": None
        }

    text = clean_html_text(info_html)
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    eng = None
    composer = None
    arranger = None
    key_sig = None
    time_sig = None
    scripture_lines = []

    bible_books = [
        "Kejadian", "Keluaran", "Imamat", "Bilangan", "Ulangan", "Yosua", "Hakim-hakim", "Rut",
        "1 Samuel", "2 Samuel", "1 Raja-raja", "2 Raja-raja", "1 Tawarikh", "2 Tawarikh",
        "Ezra", "Nehemia", "Ester", "Ayub", "Mazmur", "Amsal", "Pengkhotbah", "Kidung Agung",
        "Yesaya", "Yeremia", "Ratapan", "Yehezkiel", "Daniel", "Hosea", "Yoel", "Amos", "Obaja",
        "Yunus", "Mikha", "Nahum", "Habakuk", "Zefanya", "Hagai", "Zakharia", "Maleakhi",
        "Matius", "Markus", "Lukas", "Yohanes", "Kisah Para Rasul", "Roma", "1 Korintus", "2 Korintus",
        "Galatia", "Efesus", "Filipi", "Kolose", "1 Tesalonika", "2 Tesalonika", "1 Timotius",
        "2 Timotius", "Titus", "Filemon", "Ibrani", "Yakobus", "1 Petrus", "2 Petrus",
        "1 Yohanes", "2 Yohanes", "3 Yohanes", "Yudas", "Wahyu",
        "I Yoh", "II Yoh", "I Kor", "II Kor", "I Sam", "II Sam", "I Raj", "II Raj", "I Pet", "II Pet"
    ]

    for l in lines:
        l_low = l.lower()
        if l_low.startswith("english:"):
            eng = l.split(":", 1)[1].strip()
        elif l_low.startswith("composer:"):
            composer = l.split(":", 1)[1].strip()
        elif l_low.startswith("arranger:"):
            arranger = l.split(":", 1)[1].strip()
        elif re.search(r"(\d+[#b]\s*[-=]\s*[A-Ga-g][#b]?|[A-Ga-g][#b]?\s+\d+/\d+)", l):
            parts = l.strip().split()
            if len(parts) >= 2 and "/" in parts[-1]:
                time_sig = parts[-1]
                key_sig = " ".join(parts[:-1])
            else:
                key_sig = l.strip()
        elif any(b in l for b in bible_books):
            scripture_lines.append(l.strip())
        elif scripture_lines:
            scripture_lines.append(l.strip())

    scripture_str = " ".join(scripture_lines).strip() if scripture_lines else None

    return {
        "english_title": eng,
        "composer": composer,
        "arranger": arranger,
        "key_sig": key_sig,
        "time_sig": time_sig,
        "scripture": scripture_str
    }

def split_lyrics_lines(text):
    if not text:
        return []
    
    # Split by semicolon or punctuation followed by space and capital letter/quotes
    # Avoid splitting after commas if it's a short title/name
    raw_lines = re.split(r"(?<=[;!?])\s+|(?<=\.)\s+(?=[A-Z\"\'\“\‘])|(?<=,)\s+(?=[A-Z\"\'\“\‘][a-z]+)", text)
    
    result = []
    for line in raw_lines:
        clean_l = line.strip()
        if clean_l:
            result.append(clean_l)
    return result

def convert():
    if not os.path.exists(INPUT_FILE):
        print(f"Error: {INPUT_FILE} not found.")
        return

    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        ds = json.load(f)

    converted_dict = {}

    for k in sorted(ds.keys(), key=lambda x: int(x) if x.isdigit() else 9999):
        item = ds[k]
        num = int(k) if k.isdigit() else int(item.get("id", 0))
        title = item.get("title", f"Lagu Sion {num}").strip()
        title_full = f"{num:03d} {title.upper()}"

        info = parse_additional_info(item.get("additional_info_one"))

        # Key & Time signatures
        basic_notes = item.get("basic_notes", "") or ""
        basic_parts = basic_notes.split()
        basic_key = basic_parts[0] if len(basic_parts) > 0 else None
        basic_time = basic_parts[1] if len(basic_parts) > 1 else None

        key_sig = info["key_sig"] or basic_key
        time_sig = info["time_sig"] or basic_time

        # Author string
        authors = []
        if info["composer"]:
            authors.append(info["composer"])
        elif item.get("artist"):
            authors.append(item.get("artist"))
        if info["arranger"] and info["arranger"] not in authors:
            authors.append(f"Arr. {info['arranger']}")
        author_str = " / ".join(authors) if authors else None

        # Audio files
        audio_files = {}
        for af in item.get("file", []):
            f_name = af.get("name", "").lower()
            if "inst" in f_name:
                audio_files["instrumental"] = af.get("file")
            elif "voc" in f_name or "vocal" in f_name:
                audio_files["vocal"] = af.get("file")

        # Verses & Chorus
        raw_verses = item.get("verse", [])
        reff_text = item.get("reff")
        total_verses = len(raw_verses)

        verse_blocks = []
        for idx, v in enumerate(raw_verses):
            v_no = v.get("verse") or str(idx + 1)
            v_lyrics = v.get("lyrics", "")
            v_lines = split_lyrics_lines(v_lyrics)

            verse_blocks.append({
                "label": f"{v_no}/{total_verses}",
                "type": "verse",
                "duration": v.get("duration"),
                "lines": v_lines,
                "text": "\n".join(v_lines)
            })

            # Interleave chorus after verse 1 if reff exists
            if idx == 0 and reff_text:
                reff_lines = split_lyrics_lines(reff_text)
                verse_blocks.append({
                    "label": "Refrein",
                    "type": "chorus",
                    "lines": reff_lines,
                    "text": "\n".join(reff_lines)
                })

        converted_dict[str(num)] = {
            "number": num,
            "title": title.upper(),
            "title_display": title,
            "title_full": title_full,
            "english_title": info["english_title"],
            "time_signature": time_sig,
            "key": key_sig,
            "author": author_str,
            "scripture": info["scripture"],
            "duration": item.get("duration"),
            "sheet_music_url": item.get("musical_notes"),
            "thumbnail_url": item.get("thumbnail"),
            "audio": audio_files if audio_files else None,
            "verses": verse_blocks,
            "source": "lagusion.org"
        }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(converted_dict, f, indent=2, ensure_ascii=False)

    print(f"Converted {len(converted_dict)} songs from data-source.json into {OUTPUT_FILE} (all_songs.json is unchanged).")

if __name__ == "__main__":
    convert()
