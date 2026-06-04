export async function fetchGithubFiles(repoUrl: string, token?: string) {
  const res = await fetch("/api/github/fetch-files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repoUrl, token }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `GitHub Retrieval Failed (Status ${res.status})`);
  }

  const data = await res.json();
  if (!data.success || !data.files || data.files.length === 0) {
    throw new Error(data.message || "No suitable code source files retrieved from public folders.");
  }
  return data;
}
