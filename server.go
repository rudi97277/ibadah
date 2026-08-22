package main

import (
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
	"strings"
	"syscall"
	"time"
)

const (
	settingsFileName    = "settings.json"
	customSongsFileName = "custom_songs.json"
)

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
		// If running via `go run`, fallback to current working directory
		if _, err := os.Stat(filepath.Join(baseDir, "index.html")); os.IsNotExist(err) {
			baseDir, _ = os.Getwd()
		}
	}

	settingsPath := filepath.Join(baseDir, settingsFileName)
	customSongsPath := filepath.Join(baseDir, customSongsFileName)

	mux := http.NewServeMux()

	// API Handlers for settings and custom songs
	mux.HandleFunc("/api/settings", handleJSONAPI(settingsPath, "{}"))
	mux.HandleFunc("/api/settings/", handleJSONAPI(settingsPath, "{}"))
	mux.HandleFunc("/api/custom_songs", handleJSONAPI(customSongsPath, "[]"))
	mux.HandleFunc("/api/custom_songs/", handleJSONAPI(customSongsPath, "[]"))

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
	fmt.Println("🎵 Lagu Sion Presentation Server (Golang Native)")
	fmt.Printf("👉 Lokal:   http://localhost:%d\n", *portFlag)
	if localIP != "localhost" {
		fmt.Printf("👉 Jaringan: http://%s:%d\n", localIP, *portFlag)
	}
	fmt.Printf("👉 Folder:  %s\n", baseDir)
	fmt.Println("==================================================")
	fmt.Println("Tekan Ctrl+C untuk menghentikan server.")

	// Graceful shutdown handling
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
