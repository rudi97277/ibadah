# 📋 AGENTS.MD - Conversation Summary & Project Knowledge Base

Dokumentasi ini merangkum seluruh percakapan, evolusi arsitektur, keputusan desain, perbaikan bug, dan spesifikasi teknis dari proyek **Lagu Sion & Alkitab Presentation System**.

---

## 📌 Ringkasan Eksekutif Proyek

* **Nama Proyek**: Lagu Sion & Alkitab Church Presentation System
* **Tujuan**: Aplikasi presentasi ibadah gereja modern yang mandiri (*standalone*), cepat, hemat memori, dan bebas dependensi rumit, untuk menyajikan lirik **Lagu Sion (525 lagu + lagu kustom)** dan teks **Alkitab TB (66 kitab, 31.084 ayat)**.
* **Tech Stack**:
  * **Backend**: Golang Native HTTP Server (`server.go`), dikompilasi ke binary `server-linux` dan `server-windows.exe` (tanpa runtime eksternal).
  * **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3, `BroadcastChannel` API, `localStorage`.
  * **Data**: File teks terstruktur `alkitab_tb.txt` (ayat TB), `all_songs.json` / `songs/` (lirik & metadatas), `settings.json`, dan `custom_songs.json`.

---

## 📜 Riwayat Percakapan & Solusi yang Diterapkan

Berikut adalah kronologi seluruh permintaan pengguna (*User Requests*), analisis akar masalah, serta solusi teknis yang telah diimplementasikan:

### 1. Penanganan Proses Node & Migrasi ke Native Go
* **User Request**: *"apa node -e yang jalan sekarang?"*
* **Aksi/Solusi**:
  * Memeriksa proses latar belakang yang berjalan dan membersihkan proses Node.js sementara.
  * Memastikan sistem berjalan 100% di atas server native Golang (`server.go`) yang jauh lebih stabil dan ringan.

---

### 2. Peningkatan Navigasi Alkitab & Pembersihan Toolbar Lagu Sion
* **User Request**:
  1. *"untuk alkitab, ketika saya ketik dan tekan enter, tombol panah tidak bisa digunakan kecuali tekan tombol buka terlebih dahulu."*
  2. *"kemudian, untuk lagu sion, hilangkan tombol sebelum dan berikut yang diatas, tidak saya gunakan."*
* **Aksi/Solusi**:
  * **Keyboard Focus di Alkitab**: Menambahkan listener tombol `Enter` pada kolom pencarian ayat (`verse-search-input`). Saat ditekan, sistem otomatis memanggil `openPassage()`, mem-blur input, dan mengembalikan fokus navigasi ke tombol panah keyboard (`ArrowRight`, `ArrowLeft`, `Space`).
  * **Pembersihan Toolbar Lagu Sion**: Menghapus tombol navigasi atas `⏮ Sblm` dan `Brkt ⏭` di `index.html` agar tampilan toolbar lebih ringkas dan tidak memakan tempat.

---

### 3. Optimasi Kapasitas Teks & Eliminasi Ruang Kosong
* **User Request**:
  1. *"sepertinya, untuk pembagian ayat alkitab masih tidak sesuai. masih banyak space kosong"*
  2. *"Buat hal yang sama ke lagu juga."*
* **Aksi/Solusi**:
  * **Masalah**: Algoritma pemecahan slide sebelumnya membatasi karakter terlalu ketat (~160 karakter), menyebabkan ayat pendek (misal: *Yohanes 3:16*) dan bait 4-baris lagu terpecah menjadi `1a/1b` dengan banyak ruang kosong.
  * **Solusi**: Mengembangkan algoritma adaptif terhadap ukuran font:
    * Basis kapasitas ditingkatkan menjadi **320 karakter** pada ukuran font standar (`3.6rem`).
    * Ayat standar dan bait lagu standar 4-baris kini tampil utuh dalam **1 slide penuh** yang proporsional dan nyaman dibaca.

---

### 4. Sinkronisasi & Ketahanan Data Playlist Antar-Halaman
* **User Request**:
  1. *"ketika ke alkitab dan kembali ke lagu dan sebaliknya, playlistnya tidak ber efek lagi"*
  2. *"kenapa playlist alkitab tidak bisa mundur, hanya maju?"*
  3. *"Untuk memasukkan ayat pada urutan, buat tombol enter juga berguna"*
* **Aksi/Solusi**:
  * **Penggabungan Atomic di Server**: Menambahkan handler `handleSettingsAPI` di `server.go` dengan mekanisme *JSON deep-merge*. Menyimpan pengaturan di Alkitab tidak akan menimpa/menghapus playlist Lagu Sion di `settings.json`, dan sebaliknya.
  * **Navigasi Mundur Playlist Alkitab**: Memperbaiki fungsi `matchPlaylistItem` di `alkitab.html` agar pencocokan token singkatan (misal: `kej 1:20`, `Mat 5:2`) terhadap nama kitab lengkap bekerja secara akurat di kedua arah (maju dan mundur).
  * **Shortcut Enter pada Playlist Modal**: Menambahkan event listener `Enter` pada input ayat baru (`playlistNewRef`) dan input massal (`playlistBatchInput`) agar pengisian playlist sangat cepat.

---

### 5. Arsitektur Dual-Screen (Konsol Operator vs Layar Proyektor)
* **User Request**:
  1. *"Nah, kalau aku ngedit ngedit, pindah lagu kan bisa dilihat jemaat. Menurutmu gimana biar ada preview khusus? aku nanya nih"*
  2. *"aku ada 2 monitor, mana paling bagus?"*
* **Aksi/Solusi**:
  * Mengembangkan sistem presentasi **Dual-Screen** independen:
    1. **Monitor 1 (Layar Laptop / Operator)**: Membuka `index.html` atau `alkitab.html` sebagai pusat kendali. Operator bebas mencari lagu/ayat atau membuka drawer tanpa terlihat jemaat.
    2. **Monitor 2 (Proyektor Jemaat - `/display.html`)**: Layar bersih bebas toolbar/tombol dengan tipografi kontras tinggi.
  * Menggunakan `BroadcastChannel('lagusion_live_bus')` untuk komunikasi lokal *zero-latency* antar jendela browser.

---

### 6. Penyederhanaan Tombol Live & Toolbar Permanen
* **User Request**:
  1. *"Hilangkan tombol blank. tidak dipakai"*
  2. *"Buat tombolnya hanya satu untuk live nya. Tayangkan dan stop, jangan jadi 2 setelah di klik langsung. Kemudian, karna sudah ada halaman khusus, toolbarnya buat selalu tampak sekarang"*
* **Aksi/Solusi**:
  * **Hapus Tombol Blank**: Menghilangkan tombol `⚪ Blank` dari toolbar atas kedua halaman.
  * **Tombol Live Tunggal (`▶ Tayangkan` $\leftrightarrow$ `⏹ Stop Tayang`)**:
    * Saat belum tayang (Preview): Tombol hijau **`▶ Tayangkan`**.
    * Saat tayang (Live): Tombol merah **`⏹ Stop Tayang`**.
    * Terintegrasi dengan tombol shortcut **`Enter` / `F5`**.
  * **Toolbar Permanen (*Always Visible*)**: Mengubah CSS `.top-toolbar` dan `.bottom-toolbar` menjadi `position: fixed` dengan `opacity: 1` permanen (tidak ada timer sembunyi otomatis atau hover zone yang mengganggu operator).

---

### 7. Penyelarasan Simetris Toolbar Atas
* **User Request**:
  * *"tolong susun ulang ururan toolbar atas, untuk lagu dan alkitab, supaya tidak beda-beda posisi untuk tombol yang berhubungan. seperti urutan ayat dan urutan lagu di posisi 2, daftar lagu dan kitab pasal di posisi 1"*
* **Aksi/Solusi**:
  * Menata ulang urutan tombol pada `index.html` dan `alkitab.html` menjadi 100% simetris:
    * **Grup Kiri**: `[ 📚 Daftar / Kitab ]` $\rightarrow$ `[ 📋 Urutan Playlist ]` $\rightarrow$ `[ Pindah Halaman ]` $\rightarrow$ `[ 📺 Proyektor ]`
    * **Grup Tengah**: Kotak input pencarian/nomor & tombol `[ Buka ]`
    * **Grup Kanan**: `[ ▶ Tayangkan ]` $\rightarrow$ `[ 📄 Tampilkan Semua ]` $\rightarrow$ `[ A- ]` $\rightarrow$ `[ A+ ]` $\rightarrow$ `[ ⛶ Fullscreen ]` $\rightarrow$ `[ ⚙️ ]`

---

### 8. Dokumentasi & Manajemen Proses
* **User Request**:
  1. *"jangan jalankan sendiri servernya, biar aku yang jalankan"*
  2. *"add readme"*
  3. *"hilangkan soal obs dan panduan akses hp/tablet"*
  4. *"commit dan push"*
* **Aksi/Solusi**:
  * Menghentikan background task agent dan menyerahkan kontrol eksekusi `./server-linux` kepada pengguna.
  * Membuat dokumentasi lengkap di `README.md` dan membersihkan bagian OBS / Mobile sesuai permintaan.
  * Melakukan commit `55dc928` dan push ke repositori GitHub `origin/main`.

---

## 🏗️ Spesifikasi Arsitektur & Teknis

### 1. Struktur Komunikasi BroadcastChannel (`lagusion_live_bus`)
State yang dikirimkan ke layar proyektor (`display.html`) memiliki skema JSON berikut:

```json
{
  "mode": "song" | "bible" | "standby",
  "isBlank": false,
  "title": "001 DI HADAPAN HADIRAT-MU",
  "key": "Nada: 2#=D",
  "time": "Ketukan: 4/4",
  "showMetadata": true,
  "verseBadge": "1/4",
  "isChorus": false,
  "lyrics": "Di hadapan hadirat-Mu\nKami umat-Mu menyembah...",
  "reference": "YOHANES 3:16",
  "showVerseNum": true,
  "verseNum": 16,
  "text": "Karena begitu besar kasih Allah...",
  "fontSizeRem": 3.6,
  "fontFamily": "system-ui, sans-serif"
}
```

### 2. Layout Simetris Toolbar Operator
```text
+---------------------------------------------------------------------------------------------------------+
| [📚 Daftar/Kitab] [📋 Urutan] [📖/🎵 Switch] [📺 Proyektor] | [ Input Cari / No ] [Buka] | [▶ Tayangkan] [📄 Semua] [A-] [A+] [⛶ Full] [⚙️] |
+---------------------------------------------------------------------------------------------------------+
|                                                                                                         |
|                                       VIEWPORT OPERATOR (Lirik / Ayat)                                  |
|                                                                                                         |
+---------------------------------------------------------------------------------------------------------+
| [⏮ Lagu Sblm] [◀ Sblm]            [1] [2] [Ref] [3] (Quick Jump Bait)             [Brkt ▶] [Lagu Brkt ⏭] |
+---------------------------------------------------------------------------------------------------------+
```

---

## ⌨️ Matriks Shortcut Keyboard

| Tombol | Fungsi di Lagu Sion | Fungsi di Alkitab |
| :--- | :--- | :--- |
| **`Space` / `→` / `↓` / `PageDown`** | Pindah ke bait / slide berikutnya | Pindah ke ayat / slide berikutnya |
| **`←` / `↑` / `PageUp`** | Pindah ke bait / slide sebelumnya | Pindah ke ayat / slide sebelumnya |
| **`Enter` / `F5`** | Toggle Tayang / Stop Siaran Proyektor | Toggle Tayang / Stop Siaran Proyektor |
| **`N` / `P`** | Lagu berikutnya / Lagu sebelumnya | - |
| **`M` / `/`** | Buka/Tutup Drawer Daftar Lagu | Buka/Tutup Drawer Kitab & Pasal |
| **`L`** | Buka/Tutup Modal Urutan Lagu | Buka/Tutup Modal Urutan Ayat |
| **`F` / `F11`** | Layar Penuh (*Fullscreen*) | Layar Penuh (*Fullscreen*) |
| **`+` / `-`** | Membesarkan / mengecilkan font | Membesarkan / mengecilkan font |
| **`Escape`** | Tutup semua modal / drawer | Tutup semua modal / drawer |

---

### 9. Pembaruan Dataset Lagu Sion via Scraper & Pemisahan Variabel Ukuran Font
* **User Requests**:
  1. *"can you make a new scrapper that will get and update the songs from this website? https://alkitab.app/LS/1"*
  2. *"can you make the size for lagusion and alkitab in separate variable?"*
  3. *"gunakan all song saja. tapi, support search nya menggunakan lines juga, jangan cuma nomor dan judul"*
* **Aksi/Solusi**:
  * **Single Source of Truth (`all_songs.json`)**:
    * Menghapus folder `songs/` (525 file terpisah) dan `index.json`. Seluruh 525 lagu dimuat langsung dari satu file master `all_songs.json` (~1 MB) saat aplikasi start.
    * Menghilangkan beban sinkronisasi ganda.
  * **Pencarian Lirik Lengkap (Nomor, Judul, & Baris Lirik)**:
    * Pencarian di Drawer dan bilah input atas sekarang memeriksa nomor lagu, judul, serta **seluruh baris lirik di setiap bait/refrein**.
    * Jika ditemukan kecocokan pada baris lirik, ditampilkan *snippet* cuplikan lirik di bawah judul lagu.
  * **Scraper Mandiri (`scrape_alkitab_app.py`)**:
    * Mengambil 525 lagu secara paralel dari `https://alkitab.app/LS/{nomor}` dan menyimpannya langsung ke `all_songs.json`.
  * **Debounce Pencarian**:
    * Menggunakan debounce 150ms pada pengetikan pencarian drawer untuk performa optimal, responsif, dan hemat resource.
  * **Pemisahan Variabel Ukuran Font**:
    * **Lagu Sion**: Disimpan dalam variabel `font_size_lagusion_rem` (default `3.4rem`).
    * **Alkitab**: Disimpan dalam variabel `font_size_alkitab_rem` (default `3.6rem`).

---

### 10. Integrasi Dataset Resmi GMAHK, Text Outline / Stroke, & Random Background Loader
* **User Requests**:
  1. *"check this @data-source.json ... convert it to ur version in @all_songs.json? ... make it as the main songs."*
  2. *"implement the color in the settings and the background."*
  3. *"make the text has outer color like this @text.png"*
  4. *"make the background random from the list in background folder. i will download it later in webp format"*
* **Aksi/Solusi**:
  * **Dataset Resmi GMAHK (`all_songs.json`)**:
    * Mengonversi `data-source.json` (database resmi API Lagu Sion GMAHK) menjadi `all_songs.json` master baru dengan metadata sangat lengkap: Judul Asli Inggris, Komposer, Pengaransemen (*Arranger*), Kunci & Birama standar Lagu Sion, Ayat Alkitab referensi, URL gambar Partitur/Not Balok, dan URL streaming MP3 (Instrumental & Vokal).
  * **Text Outer Stroke / Outline Styling (Sesuai `text.png`)**:
    * Menggunakan kombinasi CSS `-webkit-text-stroke: var(--lyrics-stroke-width) var(--lyrics-stroke-color);` dengan `paint-order: stroke fill;` dan `color: var(--lyrics-text-color);`.
    * `paint-order: stroke fill;` memastikan garis luar digambar *di belakang* isi huruf sehingga huruf tetap tebal, tajam, dan tidak terpotong oleh outline.
  * **Random Background Image Loader**:
    * Menambahkan folder `background/` dan endpoint backend Golang `/api/backgrounds` yang secara otomatis memindai file `.webp`, `.jpg`, `.jpeg`, `.png`, dan `.avif`.
    * Saat lagu atau ayat baru dibuka pada mode `random`, sistem secara otomatis mengundi gambar latar belakang dari folder `background/`.
    * Dilengkapi slider kegelapan (*overlay dimming*) untuk memastikan teks selalu memiliki kontras tinggi dan mudah dibaca jemaat.
  * **Solid Background Color Picker & Akurasi Warna Layar Proyektor**:
    * Menambahkan *Color Picker* mandiri untuk **Warna Latar Polos** (`background_color`, default `#ffffff`).
    * Memperbaiki tampilan proyektor (`display.html`): pseudo-element overlay kegelapan kini hanya aktif saat mode background gambar acak (`--bg-overlay-display: block`), dan dinonaktifkan (`--bg-overlay-display: none`) saat mode solid. Hal ini memastikan warna polos yang dipilih pengguna tampil **100% presisi dan identik** di layar operator maupun layar proyektor Monitor 2 tanpa terdistorsi oleh overlay/default warna lain.
    * Row pengaturan di modal *Settings* beradaptasi secara dinamis (menampilkan *Color Picker* saat mode Polos, dan menampilkan Slider Overlay saat mode Acak Gambar).
  * **Sinkronisasi Otomatis Layar Proyektor (`display.html`)**:
    * Mengirim seluruh konfigurasi warna teks, warna garis luar, ketebalan garis luar, warna latar polos (`bgColor`), gambar background acak, dan tingkat overlay melalui `BroadcastChannel('lagusion_live_bus')` sehingga tampilan proyektor jemaat (Monitor 2) sinkron 100%.

---

## 📁 Peta File Proyek

* `index.html` — Konsol Operator untuk Lagu Sion (dengan text stroke, background switcher, dan pencarian lirik lengkap).
* `alkitab.html` — Konsol Operator untuk Alkitab TB.
* `display.html` — Halaman Layar Khusus Proyektor Jemaat (Monitor 2) dengan sinkronisasi background & text stroke otomatis.
* `server.go` — Backend native Golang yang melayani file statis dan REST API (termasuk `/api/backgrounds`).
* `server-linux` — Binary server siap jalan untuk Linux x86_64.
* `server-windows.exe` — Binary server siap jalan untuk Windows x86_64.
* `all_songs.json` — Database master 525 Lagu Sion dengan metadata komposer, bahasa Inggris, partitur, ayat Alkitab, dan audio streaming.
* `all_songs_v2.json` — Backup hasil konversi dari dataset resmi.
* `convert_data_source.py` — Script konverter dari format API `data-source.json` ke skema `all_songs.json`.
* `background/` — Folder penyimpanan gambar latar belakang (.webp, .jpg, .png).
* `alkitab_tb.txt` — Database lengkap 31.084 ayat Alkitab Terjemahan Baru.
* `settings.json` — Konfigurasi warna teks, warna garis luar, background mode, ukuran font, dan playlist ibadah.
* `custom_songs.json` — Penyimpanan lagu kustom tambahan.
* `README.md` — Panduan penggunaan pengguna akhir.
* `agents.md` — Arsip pengetahuan teknis dan histori percakapan proyek ini.
