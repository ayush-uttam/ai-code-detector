import express from "express";
import dotenv from "dotenv";
import { handleGithubFetchFiles } from "../server/controllers/githubController";
import { handleCodeAnalyze } from "../server/controllers/analyzeController";

dotenv.config();

const app = express();

app.use(express.json({ limit: "15mb" }));

// 1. Health check route
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", time: new Date() });
});

// 2. Fetch files from public GitHub repository
app.post("/api/github/fetch-files", handleGithubFetchFiles);

// 3. Analyze Code File matching pattern to detect AI
app.post("/api/analyze/code", handleCodeAnalyze);

export default app;
