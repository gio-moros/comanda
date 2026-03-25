package server

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/kris-hansen/comanda/utils/config"
)

var skippedWorkflowDirs = map[string]bool{
	".git":         true,
	".comanda":     true,
	"node_modules": true,
	"dist":         true,
	"vendor":       true,
}

// publicMiddleware applies CORS and logging without auth checks.
func (s *Server) publicMiddleware(handler http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rw := &responseWriter{
			ResponseWriter: w,
			statusCode:     http.StatusOK,
		}

		s.handleCORS(rw, r)
		if r.Method == http.MethodOptions {
			rw.WriteHeader(http.StatusOK)
			return
		}

		logRequest(func(w http.ResponseWriter, r *http.Request) {
			handler(w, r)
		})(rw, r)
	}
}

func findUIDistDir() (string, error) {
	var candidates []string

	if envPath := os.Getenv("COMANDA_UI_DIST"); envPath != "" {
		candidates = append(candidates, envPath)
	}

	if cwd, err := os.Getwd(); err == nil {
		candidates = append(candidates, filepath.Join(cwd, "ui", "dist"))
	}

	if exePath, err := os.Executable(); err == nil {
		exeDir := filepath.Dir(exePath)
		candidates = append(candidates,
			filepath.Join(exeDir, "ui", "dist"),
			filepath.Join(exeDir, "..", "ui", "dist"),
		)
	}

	for _, candidate := range candidates {
		indexPath := filepath.Join(candidate, "index.html")
		if info, err := os.Stat(indexPath); err == nil && !info.IsDir() {
			return candidate, nil
		}
	}

	return "", fmt.Errorf("ui assets not found; build the UI with 'cd ui && npm run build' or set COMANDA_UI_DIST")
}

func (s *Server) handleUIConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(UIConfigResponse{
		Success:           true,
		AuthEnabled:       s.config.Enabled,
		WorkflowsEndpoint: "/workflows",
		ContentEndpoint:   "/files/content",
		GenerateEndpoint:  "/generate",
		ProcessEndpoint:   "/process",
		YAMLProcessPath:   "/yaml/process",
	})
}

func (s *Server) handleListWorkflows(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	rootPath := r.URL.Query().Get("path")
	if rootPath == "" || rootPath == "/" {
		rootPath = "/"
	}

	fullPath := s.config.DataDir
	if rootPath != "/" {
		validatedPath, err := s.validatePath(rootPath)
		if err != nil {
			w.WriteHeader(http.StatusForbidden)
			json.NewEncoder(w).Encode(WorkflowListResponse{
				Success: false,
				Error:   fmt.Sprintf("invalid workflow path: %v", err),
			})
			return
		}
		fullPath = validatedPath
	}

	workflows, err := s.listWorkflowFiles(fullPath)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(WorkflowListResponse{
			Success: false,
			Error:   fmt.Sprintf("error listing workflows: %v", err),
		})
		return
	}

	json.NewEncoder(w).Encode(WorkflowListResponse{
		Success:   true,
		Workflows: workflows,
	})
}

func (s *Server) listWorkflowFiles(root string) ([]FileInfo, error) {
	var workflows []FileInfo

	err := filepath.WalkDir(root, func(current string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		name := entry.Name()
		if entry.IsDir() {
			if name != "." && (strings.HasPrefix(name, ".") || skippedWorkflowDirs[name]) {
				return filepath.SkipDir
			}
			return nil
		}

		ext := strings.ToLower(filepath.Ext(name))
		if ext != ".yaml" && ext != ".yml" {
			return nil
		}

		info, err := entry.Info()
		if err != nil {
			return nil
		}

		relPath, err := filepath.Rel(s.config.DataDir, current)
		if err != nil {
			return nil
		}

		workflows = append(workflows, FileInfo{
			Name:       name,
			Path:       filepath.ToSlash(relPath),
			Size:       info.Size(),
			IsDir:      false,
			CreatedAt:  info.ModTime(),
			ModifiedAt: info.ModTime(),
			Methods:    "GET,POST",
		})

		return nil
	})

	return workflows, err
}

func (s *Server) serveUI(w http.ResponseWriter, r *http.Request) {
	distDir, err := findUIDistDir()
	if err != nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		_, _ = w.Write([]byte(err.Error()))
		return
	}

	requestPath := path.Clean(strings.TrimPrefix(r.URL.Path, "/ui"))
	if requestPath == "." || requestPath == "/" {
		http.ServeFile(w, r, filepath.Join(distDir, "index.html"))
		return
	}

	relativePath := strings.TrimPrefix(requestPath, "/")
	targetPath := filepath.Join(distDir, filepath.FromSlash(relativePath))
	cleanTarget := filepath.Clean(targetPath)
	cleanDist := filepath.Clean(distDir)
	if !strings.HasPrefix(cleanTarget, cleanDist+string(os.PathSeparator)) && cleanTarget != cleanDist {
		w.WriteHeader(http.StatusForbidden)
		return
	}

	if info, err := os.Stat(cleanTarget); err == nil && !info.IsDir() {
		http.ServeFile(w, r, cleanTarget)
		return
	}

	config.DebugLog("UI asset %s not found, serving SPA index", requestPath)
	http.ServeFile(w, r, filepath.Join(distDir, "index.html"))
}
