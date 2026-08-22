# 🎵 Lagu Sion & 📖 Alkitab - Sistem Presentasi Ibadah Gereja

Aplikasi presentasi ibadah gereja modern yang ringan, cepat, dan mandiri (*standalone*) untuk menampilkan lirik **Lagu Sion** (525 lagu + lagu tambahan kustom) dan firman Tuhan dari **Alkitab Terjemahan Baru (TB)** (66 kitab, 31.084 ayat).

Dilengkapi dengan arsitektur **Dual-Screen** (Konsol Operator vs Layar Proyektor Bebas Distraksi) dan server native Golang tanpa dependensi eksternal.

---

## 🌟 Fitur Utama

### 🎵 1. Lagu Sion
- **525 Lagu Sion Lengkap**: Dilengkapi informasi nada dasar (*Key*) dan birama/ketukan (*Time Signature*).
- **Lagu Tambahan / Kustom**: Fitur tambah lagu baru mandiri tanpa nomor.
- **Pencarian Cepat**: Cari instan berdasarkan nomor lagu atau penggalan judul/lirik.
- **Navigasi Bait Fleksibel**: Tombol pintas bait (Bait 1, 2, Refrein, dst.) dan mode *Interleaving Refrein* otomatis.
- **Dua Mode Tampilan**: Mode Slide (per bait) dan Mode Tampilkan Semua (seluruh lirik dalam 1 halaman).

### 📖 2. Alkitab Terjemahan Baru (TB)
- **66 Kitab Lengkap (31.084 Ayat)**: Perjanjian Lama dan Perjanjian Baru tersimpan lokal secara *offline*.
- **Pencarian Ayat Alami (*Smart Query Parser*)**:
  - Format tunggal: `Yoh 3:16`, `kej 1:1`, `Mat 5:3`
  - Format rentang: `Mzm 23:1-6`, `1 Kor 13:1-8`
  - Format satu pasal: `Yoh 3`, `Mzm 1`
  - Mendukung singkatan nama kitab bahasa Indonesia.
- **Drawer Pemilih Kitab & Pasal**: Navigasi visual untuk memilih kitab dan pasal secara cepat.

### 🖥️ 3. Sistem Dual-Screen (Operator Controller & Layar Proyektor)
- **Konsol Operator (Monitor 1 / Laptop)**:
  - Toolbar tetap (*always visible*) dengan kontrol pencarian, playlist, pengaturan, dan navigasi.
  - Bebas mencari lagu/ayat tanpa jemaat melihat proses pengetikan.
- **Layar Proyektor Khusus (Monitor 2 / Proyektor Jemaat - `/display.html`)**:
  - 100% bersih tanpa tombol toolbar atau navigasi.
  - Sinkronisasi instan (*0ms latency*) antar jendela browser melalui `BroadcastChannel`.
- **Tombol Live Tunggal (`▶ Tayangkan` $\leftrightarrow$ `⏹ Stop Tayang`)**:
  - Tombol hijau **`▶ Tayangkan`** saat menyiapkan materi di laptop.
  - Tombol merah **`⏹ Stop Tayang`** saat siaran aktif ke proyektor (mendukung shortcut `Enter` / `F5`).

### 📋 4. Urutan Ibadah (Playlist Lagu & Ayat)
- Susun daftar lagu dan ayat yang akan dibawakan dalam satu ibadah.
- Mendukung input bertahap maupun input massal (*batch input*, misal: `001, 145, 302` atau `Yoh 3:16, Roma 8:28`).
- Navigasi maju-mundur antar item playlist secara otomatis.
- Tersimpan aman di file konfigurasi JSON.

---

## 🚀 Cara Menjalankan Aplikasi

Aplikasi ini sudah dikompilasi ke dalam binary native tunggal (*single executable*), sehingga tidak memerlukan instalasi Node.js, Python, atau database.

### 🐧 Di Linux
Buka terminal di folder project, lalu jalankan:
```bash
./server-linux
```
*(Atau tentukan port khusus: `./server-linux -port 8080`)*

### 🪟 Di Windows
Cukup **double-click** file:
```text
server-windows.exe
```

---

## 🌐 Alamat Akses (URL)

| Halaman | URL Lokal | Deskripsi |
| :--- | :--- | :--- |
| 🎵 **Lagu Sion** | `http://localhost:8080` | Konsol Operator Lagu Sion |
| 📖 **Alkitab** | `http://localhost:8080/alkitab.html` | Konsol Operator Alkitab |
| 📺 **Layar Proyektor** | `http://localhost:8080/display.html` | Layar Khusus Proyektor Jemaat (Monitor 2) |

---

## ⌨️ Daftar Shortcut Keyboard

| Shortcut | Aksi |
| :--- | :--- |
| **`Space` / `→` / `↓` / `PageDown`** | Pindah ke slide / ayat berikutnya |
| **`←` / `↑` / `PageUp`** | Pindah ke slide / ayat sebelumnya |
| **`Enter` / `F5`** | Tayangkan ke Layar Proyektor / Stop Tayang |
| **`M` / `/`** | Buka/Tutup Drawer (Daftar Lagu / Kitab & Pasal) |
| **`L`** | Buka/Tutup Modal Urutan Ibadah (Playlist) |
| **`F` / `F11`** | Masuk/Keluar Layar Penuh (*Fullscreen*) |
| **`+` / `-`** | Membesarkan / mengecilkan ukuran huruf |
| **`Escape`** | Menutup modal, drawer, atau popup |

---

## 🛠️ Kompilasi Ulang (Build from Source)

Jika Anda melakukan modifikasi pada kode sumber Golang (`server.go`), kompilasi ulang dengan perintah:

```bash
# Build untuk Linux
go build -ldflags="-s -w" -o server-linux server.go

# Build untuk Windows
GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o server-windows.exe server.go
```

---

## 📂 Struktur File Project

```text
├── index.html            # Tampilan Konsol Operator Lagu Sion
├── alkitab.html          # Tampilan Konsol Operator Alkitab
├── display.html          # Tampilan Layar Bersih Proyektor Jemaat
├── server.go             # Source code server native HTTP API (Golang)
├── server-linux          # Binary server executable untuk Linux
├── server-windows.exe    # Binary server executable untuk Windows
├── all_songs.json        # Database lirik 525 Lagu Sion
├── alkitab_tb.txt        # Database teks lengkap Alkitab Terjemahan Baru
├── custom_songs.json     # Penyimpanan lagu tambahan kustom
├── settings.json         # Konfigurasi aplikasi & playlist ibadah
└── songs/                # File lirik lagu format individu
```
