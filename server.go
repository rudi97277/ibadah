package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"syscall"
	"time"
)

const (
	settingsFileName       = "settings.json"
	customSongsFileName    = "custom_songs.json"
	alkitabPlaylistFileName = "alkitab_playlist.json"
	alkitabDataFileName    = "alkitab_tb.txt"
)

// Book metadata definition
type BibleBookInfo struct {
	ID        int      `json:"id"`
	Name      string   `json:"name"`
	Abbr      string   `json:"abbr"`
	Testament string   `json:"testament"` // "PL" or "PB"
	Aliases   []string `json:"aliases"`
	Chapters  int      `json:"chapters"`
}

type BibleVerse struct {
	ID       int    `json:"id"`
	BookID   int    `json:"book_id"`
	BookName string `json:"book_name"`
	BookAbbr string `json:"book_abbr"`
	Chapter  int    `json:"chapter"`
	Verse    int    `json:"verse"`
	Text     string `json:"text"`
}

type BibleQueryResult struct {
	Reference string       `json:"reference"`
	BookName  string       `json:"book_name"`
	BookAbbr  string       `json:"book_abbr"`
	Chapter   int          `json:"chapter"`
	VerseStart int         `json:"verse_start"`
	VerseEnd   int         `json:"verse_end"`
	Verses    []BibleVerse `json:"verses"`
}

var bibleBooks = []BibleBookInfo{
	{ID: 1, Name: "Kejadian", Abbr: "Kej", Testament: "PL", Aliases: []string{"kej", "kejadian", "gen", "genesis"}},
	{ID: 2, Name: "Keluaran", Abbr: "Kel", Testament: "PL", Aliases: []string{"kel", "keluaran", "exo", "exodus"}},
	{ID: 3, Name: "Imamat", Abbr: "Im", Testament: "PL", Aliases: []string{"im", "ima", "imamat", "lev", "leviticus"}},
	{ID: 4, Name: "Bilangan", Abbr: "Bil", Testament: "PL", Aliases: []string{"bil", "bilangan", "num", "numbers"}},
	{ID: 5, Name: "Ulangan", Abbr: "Ul", Testament: "PL", Aliases: []string{"ul", "ula", "ulangan", "deu", "deuteronomy"}},
	{ID: 6, Name: "Yosua", Abbr: "Yos", Testament: "PL", Aliases: []string{"yos", "yosua", "jos", "joshua"}},
	{ID: 7, Name: "Hakim-hakim", Abbr: "Hak", Testament: "PL", Aliases: []string{"hak", "hakim", "hakim-hakim", "jdg", "judges"}},
	{ID: 8, Name: "Rut", Abbr: "Rut", Testament: "PL", Aliases: []string{"rut", "rth", "ruth"}},
	{ID: 9, Name: "1 Samuel", Abbr: "1Sam", Testament: "PL", Aliases: []string{"1sam", "1 sam", "1samuel", "1 samuel", "1sa"}},
	{ID: 10, Name: "2 Samuel", Abbr: "2Sam", Testament: "PL", Aliases: []string{"2sam", "2 sam", "2samuel", "2 samuel", "2sa"}},
	{ID: 11, Name: "1 Raja-raja", Abbr: "1Raj", Testament: "PL", Aliases: []string{"1raj", "1 raj", "1raja-raja", "1 raja-raja", "1raja", "1 raja", "1ki", "1kings"}},
	{ID: 12, Name: "2 Raja-raja", Abbr: "2Raj", Testament: "PL", Aliases: []string{"2raj", "2 raj", "2raja-raja", "2 raja-raja", "2raja", "2 raja", "2ki", "2kings"}},
	{ID: 13, Name: "1 Tawarikh", Abbr: "1Taw", Testament: "PL", Aliases: []string{"1taw", "1 taw", "1tawarikh", "1 tawarikh", "1ch", "1chronicles"}},
	{ID: 14, Name: "2 Tawarikh", Abbr: "2Taw", Testament: "PL", Aliases: []string{"2taw", "2 taw", "2tawarikh", "2 tawarikh", "2ch", "2chronicles"}},
	{ID: 15, Name: "Ezra", Abbr: "Ezr", Testament: "PL", Aliases: []string{"ezr", "ezra", "ezr"}},
	{ID: 16, Name: "Nehemia", Abbr: "Neh", Testament: "PL", Aliases: []string{"neh", "nehemia", "nehemiah"}},
	{ID: 17, Name: "Ester", Abbr: "Est", Testament: "PL", Aliases: []string{"est", "ester", "esther"}},
	{ID: 18, Name: "Ayub", Abbr: "Ayb", Testament: "PL", Aliases: []string{"ayb", "ayub", "job"}},
	{ID: 19, Name: "Mazmur", Abbr: "Mzm", Testament: "PL", Aliases: []string{"mzm", "mazmur", "psa", "psalm", "psalms"}},
	{ID: 20, Name: "Amsal", Abbr: "Ams", Testament: "PL", Aliases: []string{"ams", "amsal", "pro", "proverbs"}},
	{ID: 21, Name: "Pengkhotbah", Abbr: "Pkh", Testament: "PL", Aliases: []string{"pkh", "pengkhotbah", "ecc", "ecclesiastes"}},
	{ID: 22, Name: "Kidung Agung", Abbr: "Kid", Testament: "PL", Aliases: []string{"kid", "kidung", "kidung agung", "sos", "songofsongs"}},
	{ID: 23, Name: "Yesaya", Abbr: "Yes", Testament: "PL", Aliases: []string{"yes", "yesaya", "isa", "isaiah"}},
	{ID: 24, Name: "Yeremia", Abbr: "Yer", Testament: "PL", Aliases: []string{"yer", "yeremia", "jer", "jeremiah"}},
	{ID: 25, Name: "Ratapan", Abbr: "Rat", Testament: "PL", Aliases: []string{"rat", "ratapan", "lam", "lamentations"}},
	{ID: 26, Name: "Yehezkiel", Abbr: "Yeh", Testament: "PL", Aliases: []string{"yeh", "yehezkiel", "ezk", "ezekiel"}},
	{ID: 27, Name: "Daniel", Abbr: "Dan", Testament: "PL", Aliases: []string{"dan", "daniel"}},
	{ID: 28, Name: "Hosea", Abbr: "Hos", Testament: "PL", Aliases: []string{"hos", "hosea"}},
	{ID: 29, Name: "Yoel", Abbr: "Yl", Testament: "PL", Aliases: []string{"yl", "yoel", "joe", "joel"}},
	{ID: 30, Name: "Amos", Abbr: "Am", Testament: "PL", Aliases: []string{"am", "amos", "amo"}},
	{ID: 31, Name: "Obaja", Abbr: "Ob", Testament: "PL", Aliases: []string{"ob", "oba", "obaja", "oba", "obadiah"}},
	{ID: 32, Name: "Yunus", Abbr: "Yun", Testament: "PL", Aliases: []string{"yun", "yunus", "jon", "jonah"}},
	{ID: 33, Name: "Mikha", Abbr: "Mi", Testament: "PL", Aliases: []string{"mi", "mik", "mikha", "mic", "micah"}},
	{ID: 34, Name: "Nahum", Abbr: "Nah", Testament: "PL", Aliases: []string{"nah", "nahum", "nam"}},
	{ID: 35, Name: "Habakuk", Abbr: "Hab", Testament: "PL", Aliases: []string{"hab", "habakuk", "habakkuk"}},
	{ID: 36, Name: "Zefanya", Abbr: "Zef", Testament: "PL", Aliases: []string{"zef", "zefanya", "zep", "zephaniah"}},
	{ID: 37, Name: "Hagai", Abbr: "Hag", Testament: "PL", Aliases: []string{"hag", "hagai", "haggai"}},
	{ID: 38, Name: "Zakharia", Abbr: "Za", Testament: "PL", Aliases: []string{"za", "zak", "zakharia", "zec", "zechariah"}},
	{ID: 39, Name: "Maleakhi", Abbr: "Mal", Testament: "PL", Aliases: []string{"mal", "maleakhi", "malachi"}},
	{ID: 40, Name: "Matius", Abbr: "Mat", Testament: "PB", Aliases: []string{"mat", "matius", "mt", "matthew"}},
	{ID: 41, Name: "Markus", Abbr: "Mrk", Testament: "PB", Aliases: []string{"mrk", "mar", "markus", "mk", "mark"}},
	{ID: 42, Name: "Lukas", Abbr: "Luk", Testament: "PB", Aliases: []string{"luk", "lukas", "lk", "luke"}},
	{ID: 43, Name: "Yohanes", Abbr: "Yoh", Testament: "PB", Aliases: []string{"yoh", "yohanes", "jn", "john"}},
	{ID: 44, Name: "Kisah Para Rasul", Abbr: "Kis", Testament: "PB", Aliases: []string{"kis", "kisah", "kisah para rasul", "act", "acts"}},
	{ID: 45, Name: "Roma", Abbr: "Rom", Testament: "PB", Aliases: []string{"rom", "roma", "romans"}},
	{ID: 46, Name: "1 Korintus", Abbr: "1Kor", Testament: "PB", Aliases: []string{"1kor", "1 kor", "1korintus", "1 korintus", "1co", "1corinthians"}},
	{ID: 47, Name: "2 Korintus", Abbr: "2Kor", Testament: "PB", Aliases: []string{"2kor", "2 kor", "2korintus", "2 korintus", "2co", "2corinthians"}},
	{ID: 48, Name: "Galatia", Abbr: "Gal", Testament: "PB", Aliases: []string{"gal", "galatia", "galatians"}},
	{ID: 49, Name: "Efesus", Abbr: "Ef", Testament: "PB", Aliases: []string{"ef", "efe", "efesus", "eph", "ephesians"}},
	{ID: 50, Name: "Filipi", Abbr: "Flp", Testament: "PB", Aliases: []string{"flp", "fil", "filipi", "php", "philippians"}},
	{ID: 51, Name: "Kolose", Abbr: "Kol", Testament: "PB", Aliases: []string{"kol", "kolose", "col", "colossians"}},
	{ID: 52, Name: "1 Tesalonika", Abbr: "1Tes", Testament: "PB", Aliases: []string{"1tes", "1 tes", "1tesalonika", "1 tesalonika", "1th", "1thessalonians"}},
	{ID: 53, Name: "2 Tesalonika", Abbr: "2Tes", Testament: "PB", Aliases: []string{"2tes", "2 tes", "2tesalonika", "2 tesalonika", "2th", "2thessalonians"}},
	{ID: 54, Name: "1 Timotius", Abbr: "1Tim", Testament: "PB", Aliases: []string{"1tim", "1 tim", "1timotius", "1 timotius", "1ti", "1timothy"}},
	{ID: 55, Name: "2 Timotius", Abbr: "2Tim", Testament: "PB", Aliases: []string{"2tim", "2 tim", "2timotius", "2 timotius", "2ti", "2timothy"}},
	{ID: 56, Name: "Titus", Abbr: "Tit", Testament: "PB", Aliases: []string{"tit", "titus"}},
	{ID: 57, Name: "Filemon", Abbr: "Flm", Testament: "PB", Aliases: []string{"flm", "filemon", "phm", "philemon"}},
	{ID: 58, Name: "Ibrani", Abbr: "Ibr", Testament: "PB", Aliases: []string{"ibr", "ibrani", "heb", "hebrews"}},
	{ID: 59, Name: "Yakobus", Abbr: "Yak", Testament: "PB", Aliases: []string{"yak", "yakobus", "jas", "james"}},
	{ID: 60, Name: "1 Petrus", Abbr: "1Pet", Testament: "PB", Aliases: []string{"1pet", "1 pet", "1petrus", "1 petrus", "1pe", "1peter"}},
	{ID: 61, Name: "2 Petrus", Abbr: "2Pet", Testament: "PB", Aliases: []string{"2pet", "2 pet", "2petrus", "2 petrus", "2pe", "2peter"}},
	{ID: 62, Name: "1 Yohanes", Abbr: "1Yoh", Testament: "PB", Aliases: []string{"1yoh", "1 yoh", "1yohanes", "1 yohanes", "1jn", "1john"}},
	{ID: 63, Name: "2 Yohanes", Abbr: "2Yoh", Testament: "PB", Aliases: []string{"2yoh", "2 yoh", "2yohanes", "2 yohanes", "2jn", "2john"}},
	{ID: 64, Name: "3 Yohanes", Abbr: "3Yoh", Testament: "PB", Aliases: []string{"3yoh", "3 yoh", "3yohanes", "3 yohanes", "3jn", "3john"}},
	{ID: 65, Name: "Yudas", Abbr: "Yud", Testament: "PB", Aliases: []string{"yud", "yudas", "jud", "jude"}},
	{ID: 66, Name: "Wahyu", Abbr: "Why", Testament: "PB", Aliases: []string{"why", "wah", "wahyu", "rev", "revelation"}},
}

// In-memory Bible store: [BookID][Chapter][Verse] -> Text
var (
	bibleVersesMap   = make(map[int]map[int]map[int]string)
	bibleBookByID    = make(map[int]*BibleBookInfo)
	bibleBookByAlias = make(map[string]*BibleBookInfo)
	bibleTotalVerses = 0
)

func initBibleMetadata() {
	for i := range bibleBooks {
		b := &bibleBooks[i]
		bibleBookByID[b.ID] = b
		bibleBookByAlias[strings.ToLower(b.Name)] = b
		bibleBookByAlias[strings.ToLower(b.Abbr)] = b
		for _, alias := range b.Aliases {
			bibleBookByAlias[strings.ToLower(alias)] = b
		}
	}
}

func loadBibleText(filePath string) error {
	file, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	// Larger buffer for very long lines
	buf := make([]byte, 64*1024)
	scanner.Buffer(buf, 1024*1024)

	maxChaptersPerBook := make(map[int]int)
	count := 0

	for scanner.Scan() {
		line := scanner.Text()
		parts := strings.Split(line, "\t")
		if len(parts) < 5 {
			continue
		}

		bookID, err1 := strconv.Atoi(parts[1])
		chapter, err2 := strconv.Atoi(parts[2])
		verse, err3 := strconv.Atoi(parts[3])
		text := strings.TrimSpace(parts[4])

		if err1 != nil || err2 != nil || err3 != nil {
			continue
		}

		if bibleVersesMap[bookID] == nil {
			bibleVersesMap[bookID] = make(map[int]map[int]string)
		}
		if bibleVersesMap[bookID][chapter] == nil {
			bibleVersesMap[bookID][chapter] = make(map[int]string)
		}

		bibleVersesMap[bookID][chapter][verse] = text
		count++

		if chapter > maxChaptersPerBook[bookID] {
			maxChaptersPerBook[bookID] = chapter
		}
	}

	for bookID, maxChap := range maxChaptersPerBook {
		if b, ok := bibleBookByID[bookID]; ok {
			b.Chapters = maxChap
		}
	}

	bibleTotalVerses = count
	return scanner.Err()
}

func findBibleBook(nameOrAlias string) *BibleBookInfo {
	cleaned := strings.ToLower(strings.TrimSpace(nameOrAlias))
	cleaned = strings.ReplaceAll(cleaned, ".", "")
	if b, ok := bibleBookByAlias[cleaned]; ok {
		return b
	}
	// Try without spaces (e.g. "1sam" vs "1 sam")
	noSpace := strings.ReplaceAll(cleaned, " ", "")
	if b, ok := bibleBookByAlias[noSpace]; ok {
		return b
	}
	// Try prefix matching
	for alias, b := range bibleBookByAlias {
		if strings.HasPrefix(alias, cleaned) || strings.HasPrefix(cleaned, alias) {
			return b
		}
	}
	return nil
}

// Parse natural query like "Yoh 3:16", "Yohanes 3:16-18", "Mzm 23", "Kej 1:1-5"
func parseBibleQuery(query string) (*BibleQueryResult, error) {
	q := strings.TrimSpace(query)
	if q == "" {
		return nil, fmt.Errorf("Query kosong")
	}

	// Regex for Book Chapter:VerseStart-VerseEnd
	// e.g. "1 Korintus 13:4-8", "Yoh 3:16-18", "Mzm 23", "Kejadian 1:1"
	re := regexp.MustCompile(`^(?i)(?:([1-3]\s*[a-zA-Z]+|[a-zA-Z\-]+))\s*(\d+)(?:[:\.](\d+)(?:\s*[-–—]\s*(\d+))?)?$`)
	matches := re.FindStringSubmatch(q)

	var book *BibleBookInfo
	var chapter, verseStart, verseEnd int

	if len(matches) > 0 {
		bookStr := matches[1]
		book = findBibleBook(bookStr)
		if book == nil {
			return nil, fmt.Errorf("Kitab '%s' tidak ditemukan", bookStr)
		}

		chapter, _ = strconv.Atoi(matches[2])
		if matches[3] != "" {
			verseStart, _ = strconv.Atoi(matches[3])
			if matches[4] != "" {
				verseEnd, _ = strconv.Atoi(matches[4])
			} else {
				verseEnd = verseStart
			}
		} else {
			// Entire chapter
			verseStart = 1
			verseEnd = 999
		}
	} else {
		// Try fallback: just book name
		book = findBibleBook(q)
		if book != nil {
			chapter = 1
			verseStart = 1
			verseEnd = 999
		} else {
			return nil, fmt.Errorf("Format ayat tidak valid. Gunakan format seperti 'Yoh 3:16' atau 'Mzm 23:1-6'")
		}
	}

	chapMap, ok := bibleVersesMap[book.ID][chapter]
	if !ok || len(chapMap) == 0 {
		return nil, fmt.Errorf("%s pasal %d tidak ditemukan (maksimal %d pasal)", book.Name, chapter, book.Chapters)
	}

	// Collect verses
	var resultVerses []BibleVerse
	maxVerseInChap := 0
	for vNum := range chapMap {
		if vNum > maxVerseInChap {
			maxVerseInChap = vNum
		}
	}

	if verseEnd > maxVerseInChap {
		verseEnd = maxVerseInChap
	}
	if verseStart > maxVerseInChap {
		verseStart = maxVerseInChap
	}
	if verseStart <= 0 {
		verseStart = 1
	}

	for v := verseStart; v <= verseEnd; v++ {
		if text, exists := chapMap[v]; exists {
			resultVerses = append(resultVerses, BibleVerse{
				ID:       book.ID*1000000 + chapter*1000 + v,
				BookID:   book.ID,
				BookName: book.Name,
				BookAbbr: book.Abbr,
				Chapter:  chapter,
				Verse:    v,
				Text:     text,
			})
		}
	}

	if len(resultVerses) == 0 {
		return nil, fmt.Errorf("Ayat tidak ditemukan untuk %s %d:%d-%d", book.Name, chapter, verseStart, verseEnd)
	}

	var refLabel string
	if verseStart == verseEnd {
		refLabel = fmt.Sprintf("%s %d:%d", book.Name, chapter, verseStart)
	} else if verseStart == 1 && verseEnd == maxVerseInChap {
		refLabel = fmt.Sprintf("%s %d:1-%d", book.Name, chapter, verseEnd)
	} else {
		refLabel = fmt.Sprintf("%s %d:%d-%d", book.Name, chapter, verseStart, verseEnd)
	}

	return &BibleQueryResult{
		Reference:  refLabel,
		BookName:   book.Name,
		BookAbbr:   book.Abbr,
		Chapter:    chapter,
		VerseStart: verseStart,
		VerseEnd:   verseEnd,
		Verses:     resultVerses,
	}, nil
}

func getExecDir() string {
	execPath, err := os.Executable()
	if err != nil {
		return "."
	}
	return filepath.Dir(execPath)
}

func noCacheMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, ".json") || strings.HasPrefix(r.URL.Path, "/api/") {
			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
			w.Header().Set("Pragma", "no-cache")
			w.Header().Set("Expires", "0")
		}
		next.ServeHTTP(w, r)
	})
}

func handleJSONAPI(filePath string, defaultContent string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")

		switch r.Method {
		case http.MethodGet:
			data, err := os.ReadFile(filePath)
			if err != nil {
				if os.IsNotExist(err) {
					_ = os.WriteFile(filePath, []byte(defaultContent), 0644)
					w.WriteHeader(http.StatusOK)
					_, _ = w.Write([]byte(defaultContent))
					return
				}
				http.Error(w, fmt.Sprintf(`{"status":"error","message":"%s"}`, err.Error()), http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(data)

		case http.MethodPost:
			body, err := io.ReadAll(r.Body)
			if err != nil {
				http.Error(w, fmt.Sprintf(`{"status":"error","message":"%s"}`, err.Error()), http.StatusBadRequest)
				return
			}
			defer r.Body.Close()

			// Format and validate JSON
			var formatted bytes.Buffer
			if err := json.Indent(&formatted, body, "", "  "); err != nil {
				http.Error(w, fmt.Sprintf(`{"status":"error","message":"Invalid JSON: %s"}`, err.Error()), http.StatusBadRequest)
				return
			}

			if err := os.WriteFile(filePath, formatted.Bytes(), 0644); err != nil {
				http.Error(w, fmt.Sprintf(`{"status":"error","message":"Failed to write file: %s"}`, err.Error()), http.StatusInternalServerError)
				return
			}

			baseName := filepath.Base(filePath)
			log.Printf("[Saved] Updated %s (%d bytes)", baseName, formatted.Len())
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"status":"success","message":"Data saved successfully"}`))

		default:
			http.Error(w, `{"status":"error","message":"Method not allowed"}`, http.StatusMethodNotAllowed)
		}
	}
}

func handleSettingsAPI(filePath string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")

		switch r.Method {
		case http.MethodGet:
			data, err := os.ReadFile(filePath)
			if err != nil {
				if os.IsNotExist(err) {
					defaultSettings := `{"font_family":"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif","font_size_lagusion_rem":3.4,"font_size_alkitab_rem":3.6,"show_metadata":true,"autohide_nav":true,"auto_split_long_verses":true,"refrain_interleaving":true,"worship_playlist":[]}`
					_ = os.WriteFile(filePath, []byte(defaultSettings), 0644)
					w.WriteHeader(http.StatusOK)
					_, _ = w.Write([]byte(defaultSettings))
					return
				}
				http.Error(w, fmt.Sprintf(`{"status":"error","message":"%s"}`, err.Error()), http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(data)

		case http.MethodPost:
			body, err := io.ReadAll(r.Body)
			if err != nil {
				http.Error(w, fmt.Sprintf(`{"status":"error","message":"%s"}`, err.Error()), http.StatusBadRequest)
				return
			}
			defer r.Body.Close()

			var incoming map[string]interface{}
			if err := json.Unmarshal(body, &incoming); err != nil {
				http.Error(w, fmt.Sprintf(`{"status":"error","message":"Invalid JSON: %s"}`, err.Error()), http.StatusBadRequest)
				return
			}

			// Read existing settings and merge
			existing := make(map[string]interface{})
			if currentBytes, err := os.ReadFile(filePath); err == nil {
				_ = json.Unmarshal(currentBytes, &existing)
			}

			for k, v := range incoming {
				existing[k] = v
			}

			mergedBytes, err := json.MarshalIndent(existing, "", "  ")
			if err != nil {
				http.Error(w, fmt.Sprintf(`{"status":"error","message":"Failed to serialize settings: %s"}`, err.Error()), http.StatusInternalServerError)
				return
			}

			if err := os.WriteFile(filePath, mergedBytes, 0644); err != nil {
				http.Error(w, fmt.Sprintf(`{"status":"error","message":"Failed to write file: %s"}`, err.Error()), http.StatusInternalServerError)
				return
			}

			log.Printf("[Saved] Merged settings.json (%d bytes)", len(mergedBytes))
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"status":"success","message":"Settings saved successfully"}`))

		default:
			http.Error(w, `{"status":"error","message":"Method not allowed"}`, http.StatusMethodNotAllowed)
		}
	}
}

func getLocalIP() string {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return "localhost"
	}
	for _, addr := range addrs {
		if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
			if ipnet.IP.To4() != nil {
				return ipnet.IP.String()
			}
		}
	}
	return "localhost"
}

func main() {
	portFlag := flag.Int("port", 8080, "Port server yang digunakan")
	dirFlag := flag.String("dir", ".", "Direktori root web yang disajikan")
	flag.Parse()

	baseDir := *dirFlag
	if baseDir == "." {
		baseDir = getExecDir()
		if _, err := os.Stat(filepath.Join(baseDir, "index.html")); os.IsNotExist(err) {
			baseDir, _ = os.Getwd()
		}
	}

	initBibleMetadata()
	alkitabPath := filepath.Join(baseDir, alkitabDataFileName)
	if err := loadBibleText(alkitabPath); err != nil {
		log.Printf("⚠️ Catatan: Tidak dapat memuat %s: %v", alkitabDataFileName, err)
	} else {
		log.Printf("📖 Berhasil memuat Alkitab TB: %d ayat dari 66 kitab", bibleTotalVerses)
	}

	settingsPath := filepath.Join(baseDir, settingsFileName)
	customSongsPath := filepath.Join(baseDir, customSongsFileName)
	alkitabPlaylistPath := filepath.Join(baseDir, alkitabPlaylistFileName)

	mux := http.NewServeMux()

	// Song & Background APIs
	mux.HandleFunc("/api/settings", handleSettingsAPI(settingsPath))
	mux.HandleFunc("/api/settings/", handleSettingsAPI(settingsPath))
	mux.HandleFunc("/api/custom_songs", handleJSONAPI(customSongsPath, "[]"))
	mux.HandleFunc("/api/custom_songs/", handleJSONAPI(customSongsPath, "[]"))
	mux.HandleFunc("/api/backgrounds", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")

		bgDir := filepath.Join(baseDir, "background")
		var bgList []string

		entries, err := os.ReadDir(bgDir)
		if err == nil {
			for _, entry := range entries {
				if entry.IsDir() {
					continue
				}
				name := entry.Name()
				ext := strings.ToLower(filepath.Ext(name))
				if ext == ".webp" || ext == ".jpg" || ext == ".jpeg" || ext == ".png" || ext == ".avif" {
					bgList = append(bgList, "background/"+name)
				}
			}
		}
		if bgList == nil {
			bgList = []string{}
		}
		_ = json.NewEncoder(w).Encode(bgList)
	})

	// Bible APIs
	mux.HandleFunc("/api/alkitab/books", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(bibleBooks)
	})

	mux.HandleFunc("/api/alkitab/query", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")

		queryStr := r.URL.Query().Get("q")
		if queryStr == "" {
			w.WriteHeader(http.StatusBadRequest)
			_ = json.NewEncoder(w).Encode(map[string]string{"status": "error", "message": "Parameter q diperlukan (misal: ?q=Yoh 3:16)"})
			return
		}

		res, err := parseBibleQuery(queryStr)
		if err != nil {
			w.WriteHeader(http.StatusNotFound)
			_ = json.NewEncoder(w).Encode(map[string]string{"status": "error", "message": err.Error()})
			return
		}

		_ = json.NewEncoder(w).Encode(res)
	})

	mux.HandleFunc("/api/alkitab/playlist", handleJSONAPI(alkitabPlaylistPath, `["Yohanes 3:16", "Mazmur 23:1-6", "Kejadian 1:1-3"]`))
	mux.HandleFunc("/api/alkitab/playlist/", handleJSONAPI(alkitabPlaylistPath, `["Yohanes 3:16", "Mazmur 23:1-6", "Kejadian 1:1-3"]`))

	// Static File Server
	fileServer := http.FileServer(http.Dir(baseDir))
	mux.Handle("/", noCacheMiddleware(fileServer))

	addr := fmt.Sprintf(":%d", *portFlag)
	server := &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	localIP := getLocalIP()
	fmt.Println("==================================================")
	fmt.Println("🎵 Lagu Sion & 📖 Alkitab Server (Golang Native)")
	fmt.Printf("👉 Lagu Sion: http://localhost:%d\n", *portFlag)
	fmt.Printf("👉 Alkitab:   http://localhost:%d/alkitab.html\n", *portFlag)
	if localIP != "localhost" {
		fmt.Printf("👉 Jaringan:  http://%s:%d\n", localIP, *portFlag)
	}
	fmt.Printf("👉 Folder:    %s\n", baseDir)
	fmt.Println("==================================================")
	fmt.Println("Tekan Ctrl+C untuk menghentikan server.")

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	<-stop
	fmt.Println("\nMematikan server...")
	_ = server.Close()
	fmt.Println("Server berhasil dihentikan.")
}
