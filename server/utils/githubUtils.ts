import { isValidHttpHeaderValue } from "./validationUtils.js";

export function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  if (!url) return null;
  const cleanUrl = url.trim().replace(/\/$/, "");
  
  try {
    const regex = /(?:https?:\/\/github\.com\/|git@github\.com:)([^\/]+)\/([^\/\.]+)(?:\.git)?/i;
    const match = cleanUrl.match(regex);
    if (match && match[1] && match[2]) {
      return { owner: match[1], repo: match[2] };
    }
  } catch (e) {
    console.error("Url parse error:", e);
  }
  return null;
}

export async function fetchFilesFromGithub(repoUrl: string, token?: string) {
  const repoDetails = parseGithubUrl(repoUrl);
  if (!repoDetails) {
    throw new Error("Invalid GitHub repository URL. Expected format: https://github.com/owner/repo");
  }

  const { owner, repo } = repoDetails;
  const headers: HeadersInit = {
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "AI-Code-Detector-App",
  };

  if (token && typeof token === "string") {
    const trimmedToken = token.trim();
    if (isValidHttpHeaderValue(trimmedToken)) {
      headers["Authorization"] = `token ${trimmedToken}`;
    } else {
      console.warn("Skipping Authorization header: GitHub token is empty or invalid (contains space/newline/bullets or is a placeholder).");
    }
  }

  // a. Fetch default branch of the repository
  const repoInfoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  
  if (!repoInfoResponse.ok) {
    if (repoInfoResponse.status === 403) {
      throw new Error("GitHub API rate limit reached or resource forbidden. Try providing a GitHub Personal Access Token is settings.");
    }
    if (repoInfoResponse.status === 404) {
      throw new Error(`Repository not found: ${owner}/${repo}. Check if the repository is public.`);
    }
    throw new Error(`GitHub API error: ${repoInfoResponse.statusText}`);
  }

  const repoInfo = await repoInfoResponse.json() as any;
  const defaultBranch = repoInfo.default_branch || "main";

  // b. Fetch the recursive git tree
  const treeResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
    { headers }
  );

  if (!treeResponse.ok) {
    throw new Error(`Failed to fetch file tree: ${treeResponse.statusText}`);
  }

  const treeData = await treeResponse.json() as any;
  const items = treeData.tree || [];

  // Filter relevant files
  const activeExtensions = [
    ".js", ".jsx", ".ts", ".tsx", ".py", ".pyw", 
    ".java", ".cpp", ".cc", ".c", ".h", ".cs", 
    ".html", ".css", ".go", ".rb", ".php", ".rs", 
    ".swift", ".kt", ".kts", ".sql", ".sh"
  ];
  
  const ignoredPaths = [
    "node_modules/", "dist/", "build/", ".git/", ".github/", 
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", 
    "assets/", "vendor/", "env/", "venv/", ".next/", "out/"
  ];

  const eligibleFiles: any[] = items.filter((item: any) => {
    if (item.type !== "blob") return false;
    
    const itemPath = item.path.toLowerCase();
    const hasIgnoredSegment = ignoredPaths.some(ignored => itemPath.includes(ignored));
    if (hasIgnoredSegment) return false;

    const hasValidExtension = activeExtensions.some(ext => itemPath.endsWith(ext));
    return hasValidExtension;
  });

  // Sort files by significance
  eligibleFiles.sort((a, b) => {
    const score = (p: string) => {
      let sc = 0;
      if (p.includes("src/")) sc += 10;
      if (p.includes("main") || p.includes("app") || p.includes("index")) sc += 5;
      if (p.endsWith(".json") || p.endsWith(".md") || p.endsWith(".css")) sc -= 5;
      return sc;
    };
    return score(b.path) - score(a.path);
  });

  const fileLimit = 30;
  const selectedFiles = eligibleFiles.slice(0, fileLimit);

  // c. Fetch the commits list
  let commits: any[] = [];
  try {
    const commitsResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=45`,
      { headers }
    );
    if (commitsResponse.ok) {
      const commitsData = await commitsResponse.json() as any[];
      
      commits = await Promise.all(
        commitsData.map(async (cmt: any, index: number) => {
          let additions = 0;
          let deletions = 0;
          let changedFiles = 0;

          if (index < (token ? 15 : 5)) {
            try {
              const detailRes = await fetch(
                `https://api.github.com/repos/${owner}/${repo}/commits/${cmt.sha}`,
                { headers }
              );
              if (detailRes.ok) {
                const detailData = await detailRes.json() as any;
                additions = detailData.stats?.additions || 0;
                deletions = detailData.stats?.deletions || 0;
                changedFiles = detailData.files?.length || 0;
              }
            } catch (detailErr) {
              console.error(`Error fetching detail for commit ${cmt.sha}:`, detailErr);
            }
          }

          return {
            sha: cmt.sha ? cmt.sha.substring(0, 7) : "",
            message: cmt.commit?.message || "",
            authorName: cmt.commit?.author?.name || "",
            authorDate: cmt.commit?.author?.date || "",
            authorAvatar: cmt.author?.avatar_url || "",
            htmlUrl: cmt.html_url || "",
            additions: additions || undefined,
            deletions: deletions || undefined,
            changedFiles: changedFiles || undefined
          };
        })
      );
    }
  } catch (err) {
    console.error("Error fetching commits:", err);
  }

  if (selectedFiles.length === 0) {
    return {
      success: true,
      owner,
      repo,
      branch: defaultBranch,
      files: [],
      commits: commits,
      message: "No code files matching typical language extensions were found in this repository."
    };
  }

  // Fetch contents for each file
  const filesWithContent = await Promise.all(
    selectedFiles.map(async (file: any) => {
      try {
        const contentRes = await fetch(file.url, { headers });
        if (!contentRes.ok) {
          return {
            path: file.path,
            error: `Could not retrieve file data: ${contentRes.statusText}`
          };
        }
        const contentData = await contentRes.json() as any;
        const decoded = Buffer.from(contentData.content || "", "base64").toString("utf8");
        
        return {
          path: file.path,
          size: file.size,
          content: decoded.length > 50000 ? decoded.substring(0, 50000) + "\n\n// ... [File content truncated for size] ..." : decoded
        };
      } catch (err: any) {
        return {
          path: file.path,
          error: err.message
        };
      }
    })
  );

  return {
    success: true,
    owner,
    repo,
    branch: defaultBranch,
    files: filesWithContent.filter((f: any) => !f.error),
    commits: commits
  };
}
