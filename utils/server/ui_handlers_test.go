package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/kris-hansen/comanda/utils/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHandleUIConfig(t *testing.T) {
	server := &Server{
		config: &config.ServerConfig{
			Enabled: true,
		},
	}

	req := httptest.NewRequest(http.MethodGet, "/ui/config", nil)
	rec := httptest.NewRecorder()

	server.handleUIConfig(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)

	var response UIConfigResponse
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&response))

	assert.True(t, response.Success)
	assert.True(t, response.AuthEnabled)
	assert.Equal(t, "/workflows", response.WorkflowsEndpoint)
	assert.Equal(t, "/files/content", response.ContentEndpoint)
	assert.Equal(t, "/generate", response.GenerateEndpoint)
	assert.Equal(t, "/process", response.ProcessEndpoint)
	assert.Equal(t, "/yaml/process", response.YAMLProcessPath)
}

func TestHandleListWorkflows(t *testing.T) {
	dataDir := t.TempDir()

	require.NoError(t, os.WriteFile(filepath.Join(dataDir, "root.yaml"), []byte("name: root"), 0644))
	require.NoError(t, os.MkdirAll(filepath.Join(dataDir, "nested"), 0755))
	require.NoError(t, os.WriteFile(filepath.Join(dataDir, "nested", "child.yml"), []byte("name: child"), 0644))
	require.NoError(t, os.WriteFile(filepath.Join(dataDir, "nested", "notes.txt"), []byte("ignore"), 0644))
	require.NoError(t, os.MkdirAll(filepath.Join(dataDir, ".hidden"), 0755))
	require.NoError(t, os.WriteFile(filepath.Join(dataDir, ".hidden", "secret.yaml"), []byte("name: hidden"), 0644))
	require.NoError(t, os.MkdirAll(filepath.Join(dataDir, "node_modules", "pkg"), 0755))
	require.NoError(t, os.WriteFile(filepath.Join(dataDir, "node_modules", "pkg", "skip.yaml"), []byte("name: skip"), 0644))

	server := &Server{
		config: &config.ServerConfig{
			DataDir: dataDir,
		},
	}

	req := httptest.NewRequest(http.MethodGet, "/workflows", nil)
	rec := httptest.NewRecorder()

	server.handleListWorkflows(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)

	var response WorkflowListResponse
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&response))
	require.True(t, response.Success)

	paths := make([]string, 0, len(response.Workflows))
	for _, workflow := range response.Workflows {
		paths = append(paths, workflow.Path)
	}

	assert.ElementsMatch(t, []string{"nested/child.yml", "root.yaml"}, paths)
}

func TestHandleListWorkflowsRejectsInvalidPath(t *testing.T) {
	server := &Server{
		config: &config.ServerConfig{
			DataDir: t.TempDir(),
		},
	}

	req := httptest.NewRequest(http.MethodGet, "/workflows?path=../outside", nil)
	rec := httptest.NewRecorder()

	server.handleListWorkflows(rec, req)

	require.Equal(t, http.StatusForbidden, rec.Code)

	var response WorkflowListResponse
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&response))
	assert.False(t, response.Success)
	assert.Contains(t, response.Error, "invalid workflow path")
}

func TestServeUI(t *testing.T) {
	distDir := t.TempDir()
	assetsDir := filepath.Join(distDir, "assets")
	require.NoError(t, os.MkdirAll(assetsDir, 0755))
	require.NoError(t, os.WriteFile(filepath.Join(distDir, "index.html"), []byte("<html>visualizer</html>"), 0644))
	require.NoError(t, os.WriteFile(filepath.Join(assetsDir, "app.js"), []byte("console.log('ui')"), 0644))
	t.Setenv("COMANDA_UI_DIST", distDir)

	server := &Server{}

	t.Run("serves index at root", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/ui/", nil)
		rec := httptest.NewRecorder()

		server.serveUI(rec, req)

		require.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "visualizer")
	})

	t.Run("serves static assets", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/ui/assets/app.js", nil)
		rec := httptest.NewRecorder()

		server.serveUI(rec, req)

		require.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "console.log")
	})

	t.Run("falls back to index for client routes", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/ui/workflows/c-stack", nil)
		rec := httptest.NewRecorder()

		server.serveUI(rec, req)

		require.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "visualizer")
	})
}
