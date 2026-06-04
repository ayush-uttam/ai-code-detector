import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { handleGithubFetchFiles } from "./server/controllers/githubController";
import { handleCodeAnalyze } from "./server/controllers/analyzeController";

dotenv.config();

const app = express();
const PORT = 3000;

// Set up middleware
app.use(express.json({ limit: "15mb" }));

// 1. Health check route
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", time: new Date() });
});

// 2. Fetch files list and contents from public GitHub repository
app.post("/api/github/fetch-files", handleGithubFetchFiles);

// 3. Analyze Code File matching pattern to detect AI
app.post("/api/analyze/code", handleCodeAnalyze);

// Configure Vite middleware or static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Vite dev mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Mounted Vite development middleware");
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static files from", distPath);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AI Code Detector Server running on http://localhost:${PORT}`);
  });
}

startServer();
export default app;
