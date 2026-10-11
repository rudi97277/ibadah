# 📋 AGENTS.MD - Comprehensive Project Knowledge Base & AI Agent Guide

Dokumentasi ini adalah **panduan utama dan sumber kebenaran teknis (Single Source of Truth)** untuk AI Agent yang bekerja pada proyek **Lagu Sion & Alkitab Presentation System**. Panduan ini mencakup filosofi desain, arsitektur sistem, struktur modular, protokol komunikasi, skema data, kronologi keputusan teknis, dan aturan operasional ketat.

---

## 📌 1. Ringkasan Eksekutif & Filosofi Desain

* **Nama Proyek**: Lagu Sion & Alkitab Church Presentation System
* **Tujuan**: Aplikasi presentasi ibadah gereja mandiri (*standalone*), berkinerja tinggi, hemat sumber daya, dan bebas dependensi runtime (zero external dependencies) untuk menampilkan lirik **Lagu Sion** (525 lagu resmi GMAHK + lagu kustom) dan firman Tuhan dari **Alkitab Terjemahan Baru (TB)** (66 kitab, 31.084 ayat).
* **Prinsip & Filosofi Desain**:
  1. **Zero External Runtime**: Tidak menggunakan Node.js, npm, Webpack, Python di environment produksi, atau framework frontend berat (React/Vue). Server ditulis dalam native Go standar dan frontend menggunakan Vanilla JavaScript (ES6 Modules).
  2. **Dual-Screen Architecture**: Pemisahan tegas antara Konsol Operator (laptop/monitor 1) yang fleksibel dan interaktif, dengan Layar Proyektor Jemaat (monitor 2) yang 100% bersih, bebas tombol, dan berfokus penuh pada kenyamanan visual jemaat.
  3. **Zero-Latency Local Synchronization**: Menggunakan browser native `BroadcastChannel` API (`lagusion_live_bus`) dengan sinkronisasi instan antar jendela browser lokal, didukung fallback `localStorage` dan event `storage`.
  4. **Resilience & Graceful Fallbacks**: Mekanisme penyimpanan bertingkat (Server API $\rightarrow$ Disk File Handle $\rightarrow$ LocalStorage $\rightarrow$ In-memory state) untuk menjamin data pengaturan dan lagu kustom tidak pernah hilang jika server offline.

---

## 📁 2. Peta & Struktur Direktori Proyek

```text
/home/rudi97278/projects/ibadah/
├── index.html               # Konsol Operator Lagu Sion (Toolbar, viewport lirik, drawer, modal)
├── alkitab.html             # Konsol Operator Alkitab TB (Drawer kitab/pasal, pencarian ayat, playlist)
├── display.html             # Layar Proyektor Khusus Jemaat (Monitor 2: bersih, bebas kontrol)
├── server.go                # Backend native HTTP server (Golang standar, Bible parser, REST API)
├── server-linux             # Binary server executable untuk Linux x86_64
├── server-windows.exe       # Binary server executable untuk Windows x86_64
├── all_songs.json           # Database master 525 Lagu Sion (metadata lengkap, partitur, audio)
├── alkitab_tb.txt           # Database teks Alkitab TB (31.084 baris TSV: ID, BookID, Chap, Verse, Text)
├── custom_songs.json        # File penyimpanan lagu tambahan/kustom mandiri
├── settings.json            # Konfigurasi global aplikasi & antrean playlist (Lagu Sion & Alkitab)
├── README.md                # Dokumentasi petunjuk penggunaan untuk pengguna akhir
├── agents.md                # Panduan teknis & knowledge base untuk AI Agent
│
├── js/                      # Arsitektur Frontend Modular (ES6 Modules)
│   ├── app.js               # Entry point bootstrap aplikasi Lagu Sion
│   ├── state.js             # Reactive global state, default config, findSong, persistence fallbacks
│   ├── navigation.js        # Logika perpindahan slide, antar lagu, dan tracking urutan ibadah
│   ├── song-utils.js        # Dynamic verse splitting, formatting, filter parser (322:1), line limiter
│   ├── song-loader.js       # Pemuatan data master, background scanner, file system handle
│   ├── render.js            # Manipulasi DOM, styling outline/stroke, render slide, toast notifications
│   ├── drawer.js            # Kontrol drawer daftar lagu, tabs (Sion vs Tambahan), 150ms debounced search
│   ├── playlist.js          # Pengelolaan urutan ibadah (tambah, hapus, susun ulang, batch input)
│   ├── projector.js         # Window Management API (auto dual-monitor launch), BroadcastChannel sync
│   ├── toolbar.js           # Responsive autohide toolbar logic dengan hover zones
│   ├── keyboard.js          # Event listener shortcut keyboard global
│   ├── audio.js             # Pemutar audio instrumental lokal/remote HTML5 Audio
│   └── events.js            # Registrasi event listener UI & inisialisasi aplikasi (init)
│
├── background/              # Aset gambar background (.webp, .jpg, .png) dipindai dinamis oleh server
│   ├── SDAH002_result.webp
│   └── ... (beragam background resolusi tinggi bertema alam/rohani)
│
├── audio/                   # Direktori aset audio musik lagu
│   └── instrumental/        # File MP3 instrumental lokal (dinamai: 1.mp3, 2.mp3, dst.)
│
├── sheets/                  # Aset partitur musik / not balok (JPEG, 1.jpeg - 525.jpeg) [Git-ignored]
├── all_song_new/            # File JSON lagu individu (1.json - 525.json) [Git-ignored]
│
├── crawler.py               # (Tooling Historis) Script crawler blog Lagu Sion lama
├── scrape_alkitab_app.py    # (Tooling Historis) Script scraper lirik dari alkitab.app
└── convert_data_source.py   # (Tooling Historis) Script konverter format data-source.json GMAHK
```

---

## 🏗️ 3. Arsitektur Sistem & Spesifikasi Sub-Sistem

### 🖥️ A. Backend Go Native (`server.go`)
1. **Zero External Dependencies**: Hanya memanfaatkan paket standar Go (`net/http`, `encoding/json`, `bufio`, `os`, `regexp`, dll.).
2. **In-Memory Bible Engine**:
   * Saat server start, membaca seluruh 31.084 baris dari `alkitab_tb.txt` ke dalam map bertingkat in-memory:
     `bibleVersesMap[BookID][Chapter][Verse] -> Text`.
   * Waktu muat < 100ms dengan penggunaan memori yang sangat hemat.
   * `initBibleMetadata()` memetakan 66 kitab lengkap dengan singkatan resmi dan alias pencarian (contoh: `kej`, `gen`, `1sam`, `yoh`).
3. **Smart Natural Language Bible Query Parser**:
   * Endpoint: `GET /api/alkitab/query?q={query}`
   * Mendukung variasi format:
     * Tunggal: `Yoh 3:16`, `Mat 5:3`
     * Rentang: `Mzm 23:1-6`, `1 Kor 13:4-8`
     * Satu pasal penuh: `Yoh 3`, `Mzm 1`
4. **Atomic Deep-Merge Settings Handler (`handleSettingsAPI`)**:
   * Endpoint: `GET /api/settings` & `POST /api/settings`
   * Saat menerima payload POST, server membaca `settings.json` yang ada di disk terlebih dahulu, lalu melakukan merge properti (*JSON deep-merge*). Hal ini mencegah halaman Alkitab menimpa konfigurasi Lagu Sion dan sebaliknya.
5. **Dynamic Background Scanner**:
   * Endpoint: `GET /api/backgrounds`
   * Memindai folder `background/` secara otomatis untuk file berekstensi `.webp`, `.jpg`, `.jpeg`, `.png`, dan `.avif`, lalu mengembalikan array path JSON.
6. **No-Cache Middleware**:
   * Mencegah caching browser pada endpoint REST API dan file `.json` agar sinkronisasi selalu akurat.
7. **Kompilasi Standalone**:
   * Linux: `go build -ldflags="-s -w" -o server-linux server.go`
   * Windows: `GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o server-windows.exe server.go`

---

### 🌐 B. Frontend ES6 Modules (`js/`)

Arsitektur script pada `index.html` telah dimodularisasi penuh menjadi ES6 Modules di folder `js/`:

| Modul | Tugas Utama |
| :--- | :--- |
| `state.js` | State reactive global (`state`), nilai default (`defaultSettings`), pencarian lagu fleksibel (`findSong`), dan persistensi pengaturan bertingkat. |
| `navigation.js` | Fungsi navigasi maju/mundur slide (`nextSlide`, `prevSlide`), navigasi antar lagu (`nextSong`, `prevSong`), dan pelacakan antrean playlist. |
| `song-utils.js` | Algoritma pemecahan ayat (`splitVerseIntoPages`), perhitungan baris/karakter adaptif terhadap ukuran font, parsing token bait spesifik playlist (`parsePlaylistItem`, misal `322:1`), dan parser lirik kustom. |
| `song-loader.js` | Pengambilan background (`loadBackgrounds`), master lagu (`loadAllSongs`), lagu kustom, dan File System Access API (`connectDiskFileHandle`). |
| `render.js` | Rendering teks slide, outline text stroke, pills nomor bait bawah, badge antrean, dan toast message. |
| `drawer.js` | Manajemen drawer daftar lagu, tab switching (Sion vs Tambahan), filter pencarian debounced 150ms untuk nomor, judul, dan seluruh baris lirik. |
| `playlist.js` | Manajemen antrean ibadah Lagu Sion: modal dialog, tambah/hapus, drag/move up-down, dan batch text parser. |
| `projector.js` | Integrasi multi-monitor otomatis via Window Management API, BroadcastChannel synchronization, dan toggle siaran Live. |
| `toolbar.js` | Pengendalian auto-hide toolbar atas & bawah melalui hover trigger zone dan setting `autohide_nav`. |
| `keyboard.js` | Handler shortcut keyboard global (Spasi, Panah, Enter/F5, M, L, dll.). |
| `audio.js` | Pemutar audio instrumental HTML5. Otomatis memutar file lokal `audio/instrumental/<nomor>.mp3` atau URL streaming remote GMAHK. Mengatur transisi lagu saat audio aktif. |
| `events.js` | Event wiring antara elemen DOM dan fungsi logika, serta orchestrator inisialisasi aplikasi (`init()`). |

---

### 📺 C. Layar Proyektor Khusus (`display.html`)

Halaman `display.html` didesain khusus untuk Monitor 2 (Proyektor Jemaat):
* **Bebas Kontrol**: Tidak ada tombol toolbar, drawer, atau panel navigasi.
* **Auto Placement**: Saat tombol `📺 Proyektor` ditekan pada konsol operator, script menggunakan `window.getScreenDetails()` untuk mendeteksi layar kedua yang non-primary dan otomatis membuka jendela di layar tersebut serta memicu fullscreen.
* **Tipografi Kontras Tinggi & Text Stroke**:
  * Menggunakan CSS `-webkit-text-stroke: var(--lyrics-stroke-width) var(--lyrics-stroke-color);`
  * Dilengkapi `paint-order: stroke fill;` agar garis luar berada di belakang teks sehingga teks tetap tebal, solid, dan mudah dibaca dari jarak jauh.
* **Projector Independent Font Scale**: Mendukung variabel `projector_font_scale` (pengali font khusus proyektor, misal `1.4x`) sehingga teks di layar proyektor dapat diperbesar secara independen dari tampilan layar laptop operator.
* **Safe DOM Construction**: Menggunakan pembuatan elemen DOM terstruktur (`textContent` dan `appendChild`) demi keamanan dan performa maksimal.
* **Standby Mode**: Menampilkan pesan siap siaga anggun saat operator mematikan siaran (`⏹ Stop Tayang`).

---

## 📡 4. Protokol Komunikasi & Skema Data

### 1. Pesan BroadcastChannel (`lagusion_live_bus`)

Komunikasi antara konsol operator (`index.html` & `alkitab.html`) dan layar proyektor (`display.html`):

#### A. Tipe Pesan `DISPLAY_UPDATE` (Lagu Sion):
```json
{
  "type": "DISPLAY_UPDATE",
  "state": {
    "mode": "song",
    "isBlank": false,
    "title": "001 DI HADAPAN HADIRAT-MU",
    "key": "2#=D",
    "time": "4/4",
    "showMetadata": false,
    "verseBadge": "1/4",
    "isChorus": false,
    "lyrics": "Di hadapan hadirat-Mu, Kami umat-Mu menyembah\nMengakui Engkau Tuhan, Allah kekal, Maha kuasa",
    "fontSizeRem": 4.1,
    "projectorFontScale": 1.4,
    "fontFamily": "system-ui, -apple-system, sans-serif",
    "textColor": "#ffffff",
    "strokeColor": "#000000",
    "strokeWidth": 4.0,
    "bgColor": "#ffffff",
    "bgImage": "background/SDAH124_result.webp",
    "bgOverlay": 0.6
  }
}
```

#### B. Tipe Pesan `DISPLAY_UPDATE` (Alkitab TB):
```json
{
  "type": "DISPLAY_UPDATE",
  "state": {
    "mode": "bible",
    "isBlank": false,
    "reference": "YOHANES 3:16",
    "showVerseNum": true,
    "verseNum": 16,
    "text": "Karena begitu besar kasih Allah akan dunia ini...",
    "fontSizeRem": 3.3,
    "projectorFontScale": 1.4,
    "fontFamily": "system-ui, -apple-system, sans-serif",
    "textColor": "#ffffff",
    "strokeColor": "#000000",
    "strokeWidth": 4.0,
    "bgColor": "#ffffff",
    "bgImage": "background/SDAH124_result.webp",
    "bgOverlay": 0.6
  }
}
```

#### C. Sinyal Handshake:
* `REQUEST_PING`: Dikirim oleh operator untuk mengecek ketersediaan proyektor.
* `DISPLAY_CONNECTED` / `DISPLAY_READY`: Dibalas oleh proyektor saat halaman dimuat.
* `REQUEST_SYNC`: Diminta oleh proyektor saat pertama kali terbuka untuk mengambil slide yang sedang aktif.

---

### 2. Skema Konfigurasi Global (`settings.json`)
```json
{
  "auto_split_long_verses": true,
  "autohide_nav": false,
  "background_color": "#ffffff",
  "background_mode": "random",
  "background_overlay_opacity": 0.6,
  "font_family": "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  "font_size_alkitab_rem": 3.3,
  "font_size_lagusion_rem": 4.1,
  "projector_font_scale": 1.4,
  "refrain_interleaving": true,
  "show_metadata": false,
  "show_verse_num": true,
  "text_color": "#ffffff",
  "text_stroke_color": "#000000",
  "text_stroke_width_px": 4.0,
  "worship_playlist": [322, "223:1", "73:1-2"],
  "alkitab_playlist": ["Yohanes 3:16", "Mazmur 23:1-6"]
}
```

---

### 3. Skema Data Lagu Sion (`all_songs.json`)
Setiap lagu memiliki struktur data lengkap hasil konversi API resmi GMAHK:
```json
{
  "number": 1,
  "title": "DI HADAPAN HADIRAT-MU",
  "title_display": "Di Hadapan Hadirat-Mu",
  "title_full": "001 DI HADAPAN HADIRAT-MU",
  "english_title": "Before Jehovah's Awful Throne",
  "time_signature": "4/4",
  "key": "2#=D",
  "author": "Isaac Watts / Arr. John Hatton",
  "scripture": null,
  "duration": "03:12",
  "sheet_music_url": "https://sdama-admin.lagusion.org/api/resource-gambar/.../view",
  "thumbnail_url": "https://sdama-admin.lagusion.org/api/resource-thumbnail/.../view",
  "audio": {
    "instrumental": "https://storage.lagusion.org/assets/files/song/lsebins001.mp3",
    "vocal": "https://storage.lagusion.org/assets/files/song/lsebvoc001.mp3"
  },
  "verses": [
    {
      "label": "1/4",
      "type": "verse",
      "lines": [
        "Di hadapan hadirat-Mu, Kami umat-Mu menyembah",
        "Mengakui Engkau Tuhan, Allah kekal, Maha kuasa"
      ],
      "text": "Di hadapan hadirat-Mu, Kami umat-Mu menyembah\nMengakui Engkau Tuhan, Allah kekal, Maha kuasa",
      "duration": "00:13"
    }
  ],
  "source": "lagusion.org"
}
```

---

### 4. Skema Data Lagu Tambahan (`custom_songs.json`)
Lagu kustom/tambahan mandiri disimpan dalam `custom_songs.json`:
```json
{
  "id": "misi-kita",
  "title": "Misi Kita",
  "key": "G",
  "time_signature": "4/4",
  "author": "Pdt. X",
  "is_custom": true,
  "audio": {
    "instrumental": "audio/instrumental/misi-kita.mp3"
  },
  "verses": [
    {
      "type": "verse",
      "label": "1/2",
      "lines": ["Kita terpanggil, untuk b'ritakan", "Hanya Yesuslah jalan"]
    }
  ]
}
```
* **Audio Instrumental Link**:
  * Standar: `"audio": { "instrumental": "audio/instrumental/nama-lagu.mp3" }`
  * Shorthand fleksibel: `"audio": { "instrumental": "nama-lagu.mp3" }` atau `"instrumental": "nama-lagu.mp3"` (otomatis dipetakan oleh `js/audio.js` ke folder `audio/instrumental/`).
  * URL eksternal: `"https://..."` juga didukung langsung.

---

### 5. Skema Data Alkitab TB (`alkitab_tb.txt`)
Format Tab-Separated Values (TSV) tanpa header:
* **Kolom 1**: Nomor Urut Ayat Global (1 s.d. 31084)
* **Kolom 2**: ID Kitab (1 s.d. 66)
* **Kolom 3**: Nomor Pasal
* **Kolom 4**: Nomor Ayat
* **Kolom 5**: Teks Firman Tuhan

---

## ⌨️ 5. Matriks Shortcut Keyboard Lengkap

| Tombol Shortcut | Aksi di Lagu Sion (`index.html`) | Aksi di Alkitab (`alkitab.html`) | Aksi di Proyektor (`display.html`) |
| :--- | :--- | :--- | :--- |
| **`Space` / `→` / `↓` / `PageDown`** | Pindah ke slide/bait berikutnya | Pindah ke slide/ayat berikutnya | - |
| **`←` / `↑` / `PageUp`** | Pindah ke slide/bait sebelumnya | Pindah ke slide/ayat sebelumnya | - |
| **`Enter` / `F5`** | Toggle Tayang $\leftrightarrow$ Stop Siaran | Toggle Tayang $\leftrightarrow$ Stop Siaran | - |
| **`N` / `P`** | Lagu berikutnya / Lagu sebelumnya | - | - |
| **`M` / `/`** | Buka/Tutup Drawer Daftar Lagu | Buka/Tutup Drawer Kitab & Pasal | - |
| **`L`** | Buka/Tutup Modal Urutan Lagu | Buka/Tutup Modal Urutan Ayat | - |
| **`B` / `.`** | Layar Blank Gelap Sementara | Layar Blank Gelap Sementara | - |
| **`+` / `-`** | Membesarkan / Mengecilkan font | Membesarkan / Mengecilkan font | - |
| **`F` / `F11`** | Layar Penuh (*Fullscreen*) | Layar Penuh (*Fullscreen*) | Layar Penuh (*Fullscreen*) |
| **`Escape`** | Tutup Drawer, Modal, atau Blank | Tutup Drawer, Modal, atau Blank | - |

---

## 📜 6. Riwayat Keputusan Desain & Evolusi Fitur

Berikut adalah histori perubahan, permintaan pengguna, dan keputusan arsitektural yang wajib dipahami oleh agent:

1. **Migrasi ke Native Golang**: Mengeliminasi ketergantungan runtime Node.js/Python di mesin pengguna. Server native Go (`server.go`) menyediakan REST API dan file server dalam single executable.
2. **Keyboard Focus Navigasi Alkitab**: Menekan `Enter` pada input ayat langsung memanggil `openPassage()`, melepas fokus input (`blur()`), dan mengembalikan kontrol navigasi ke tombol panah keyboard.
3. **Optimasi Kapasitas Karakter & Pemecahan Slide**: Dihitung secara matematis melalui fungsi `getMaxLinesForFontSize()` dan `getMaxCharsForFontSize()` di `song-utils.js` agar bait standar tidak terpotong canggung dan ruang kosong terminimalisir.
4. **Pembersihan Label Sub-Halaman**: Menghapus penomoran pecahan seperti `1a`, `1b`, `Ref.a` pada badge penampil agar tampilan ibadah tetap rapi dan formal (`1/4`, `2/4`, `Refrein`).
5. **Dukungan Penargetan Bait Spesifik di Playlist**: Fitur `parsePlaylistItem` mendukung sintaks seperti `322:1`, `223:2-4` sehingga operator dapat menentukan bait spesifik yang akan dinyanyikan dalam ibadah.
6. **Refaktor Modular ES Modules**: Seluruh kode frontend `index.html` dipisahkan ke modul-modul terfokus dalam `js/` (`state.js`, `navigation.js`, `song-utils.js`, `render.js`, dll.) untuk maintainability jangka panjang.
7. **Window Management Auto-Placement**: Integrasi `window.getScreenDetails()` untuk otomatis mendeteksi monitor kedua non-primer dan memposisikan proyektor secara presisi tanpa perlu drag manual oleh operator.
8. **Text Outer Stroke & Styling GMAHK**: Tipografi teks lirik menggunakan `-webkit-text-stroke` dengan `paint-order: stroke fill;` untuk keterbacaan optimal di atas latar gambar background apa pun.
9. **Sistem Background Acak & Dimming Overlay**: Memindai direktori `background/` secara dinamis dan mengacak gambar setiap berganti lagu pada mode `random`, dilengkapi slider kegelapan (*overlay opacity*).
10. **Pengali Huruf Layar Proyektor (`projector_font_scale`)**: Pengaturan slider mandiri untuk mengalikan ukuran font pada proyektor secara proporsional terhadap ukuran font layar kontroler laptop.
11. **Sistem Pemutar Musik Instrumental (`js/audio.js`)**: Tombol `▶ Play` / `⏸ Pause` pada toolbar atas. Otomatis membaca file lokal `audio/instrumental/<nomor>.mp3` atau URL audio resmi. Menghentikan lagu lama saat berpindah dan melanjutkan playback jika status sebelumnya sedang aktif.
12. **Perilaku Toolbar Autohide Terpadu**: Toolbar atas dan bawah mendukung hover zone (`.top-hover-zone` dan `.bottom-hover-zone`) saat setting `autohide_nav` aktif, atau tetap tampak permanen saat dinonaktifkan.
13. **Penyederhanaan UI**: Menghapus tombol "Tampilkan Semua" (*Full Song Mode*) dan tombol duplikat fullscreen dari toolbar atas agar tampilan operator bersih dan fokus pada alur presentasi ibadah utama.
14. **Standarisasi Format Baris Lirik (`all_songs.json`)**:
    * Seluruh baris lirik pada setiap bait (`verse`) dan refrein (`chorus`) telah distandarisasi untuk kenyamanan tayangan proyektor:
      * **Pembersihan Tanda Baca Akhir**: Tanda baca di akhir setiap baris (`.`, `,`, `;`, `:`) dihapus bersih pada semua baris lagu.
      * **Pemecahan Baris Panjang**: Baris yang terlalu panjang (> 48 karakter) dipecah pada pemisah alami (koma, titik koma, kapitalisasi klausa) dengan panjang seimbang (~20–45 karakter per baris).
      * **Penggabungan Baris Terlalu Pendek**: Baris terisolasi/1 kata (seperti `"Tuhan,"`, `"Amin."`) dan potongan pendek digabungkan ke baris pendamping (misalnya pada Lagu 514 dan Lagu 519) agar proporsi visual slide proyektor seimbang dan rapi.
      * Kolom `lines` (array) dan `text` (`lines.join('\n')`) selalu disinkronkan.
15. **Harmonisasi Modal Urutan Ibadah (Lagu Sion & Alkitab)**:
    * Modal Urutan Lagu (`index.html`) dan Urutan Ayat (`alkitab.html`) kini diseragamkan dengan satu input textarea multiline yang leluasa (`rows="3"`).
    * Mendukung pemisah koma, spasi, titik koma, maupun baris baru (Enter).
    * Shortcut keyboard `L` membuka/menutup modal playlist di kedua halaman secara konsisten.
16. **Verifikasi Ayat Otomatis pada Playlist Alkitab**:
    * Saat operator menyimpan urutan ayat (`Set Urutan` / `Ctrl+Enter`), sistem secara asinkron memvalidasi setiap ayat ke server engine (`/api/alkitab/query`).
    * Ayat yang valid dinormalisasi ke format resmi (contoh: `yoh 3:16` -> `Yohanes 3:16`).
    * Referensi palsu/salah ketik (seperti kitab yang tidak ada atau nomor ayat yang melebihi jumlah ayat dalam pasal) otomatis diabaikan dan tidak dimasukkan ke antrean.
17. **Eliminasi Native Alert/Confirm Window (Proteksi Layar Penuh / Fullscreen)**:
    * Seluruh panggilan native browser `alert()` dan `confirm()` dihilangkan 100% dan digantikan dengan sistem notifikasi `showToast()`. Hal ini mencegah mode fullscreen browser terputus secara tiba-tiba saat ibadah berlangsung.
    * Tombol **🗑️ Kosongkan** langsung mengosongkan antrean ibadah tanpa dialog konfirmasi yang mengganggu, serta tetap mempertahankan teks yang sedang diketik pada textarea input.

---

## ⚠️ 7. Aturan Operasional Kritis untuk AI Agent (DO NOT BREAK)

1. **JANGAN JALANKAN SERVER SECARA OTOMATIS**:
   * Pengguna secara eksplisit meminta untuk menjalankan binary server sendiri (`./server-linux` atau `server-windows.exe`).
   * Agent **DILARANG** menjalankan perintah daemon atau background process yang mengunci port server 8080 kecuali diminta secara eksplisit oleh pengguna untuk tujuan testing sementara.
2. **JANGAN PERNAH MENAMBAHKAN NPM / NODE / DEPENDENSI EKSTERNAL**:
   * Jangan menambahkan `package.json`, `webpack`, `vite`, atau library JavaScript eksternal via CDN jika dapat diselesaikan dengan Vanilla JavaScript standar.
   * Proyek ini dirancang agar dapat dijalankan secara offline 100% di gereja tanpa koneksi internet.
3. **PERTAHANKAN SINGLE SOURCE OF TRUTH**:
   * File `all_songs.json` adalah master dataset Lagu Sion. Jangan membuat duplikasi database baru kecuali file backup sementara.
   * File `settings.json` adalah pusat konfigurasi terpadu. Pastikan endpoint `/api/settings` selalu menggunakan deep-merge agar pengaturan Alkitab dan Lagu Sion tidak saling menimpa.
4. **PERTAHANKAN SINKRONISASI DUAL-SCREEN**:
   * Setiap kali menambahkan pengaturan visual baru (misal font, warna, styling), pastikan state tersebut dikirim melalui `BroadcastChannel('lagusion_live_bus')` dan ditangani secara identik di `display.html`.
5. **JAGA KESELARASAN TOOLBAR ANTARA LAGU SION & ALKITAB**:
   * Toolbar kontrol di `index.html` dan `alkitab.html` harus selalu simetris posisinya agar operator tidak bingung saat berpindah antara lagu dan firman Tuhan.
6. **INTEGRITAS FILE DOKUMENTASI**:
   * Selalu perbarui `README.md` jika ada fitur baru yang berinteraksi langsung dengan pengguna akhir, dan perbarui `agents.md` jika ada perubahan arsitektur atau keputusan teknis baru.

---

## 🛠️ 8. Panduan Build & Verifikasi

### Build Server Binary:
```bash
# Build untuk Linux x86_64
go build -ldflags="-s -w" -o server-linux server.go

# Build untuk Windows x86_64
GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o server-windows.exe server.go
```

### Checklist Verifikasi Kode:
* [ ] Jalankan `go vet server.go` untuk memastikan kode Golang valid dan tidak ada error syntax.
* [ ] Pastikan seluruh import ES6 modul di `js/*.js` memiliki ekstensi `.js` yang valid.
* [ ] Pastikan tidak ada syntax error JavaScript di console browser.
* [ ] Uji responsivitas `BroadcastChannel` antara jendela kontroler dan `display.html`.
* [ ] Periksa bahwa `settings.json` tetap ter-format rapi dan valid JSON.
