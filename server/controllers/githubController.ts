import { Request, Response } from "express";
import { fetchFilesFromGithub } from "../utils/githubUtils";

export async function handleGithubFetchFiles(req: Request, res: Response): Promise<void> {
  const { repoUrl, token } = req.body;

  if (!repoUrl) {
    res.status(400).json({ error: "No repository URL provided" });
    return;
  }

  try {
    const result = await fetchFilesFromGithub(repoUrl, token);
    res.json(result);
  } catch (error: any) {
    console.error("Fetch GitHub Error:", error);
    res.status(500).json({ error: error.message || "An error occurred while fetching from GitHub API" });
  }
}
