import { useState, useEffect } from "react";
import { secureKey, resolveKey } from "../utils/crypto";

export function useGithubToken(userId?: string) {
  const [githubToken, setGithubTokenState] = useState<string>("");

  useEffect(() => {
    let active = true;
    if (userId) {
      const savedToken = localStorage.getItem("github_pat_token");
      if (savedToken) {
        resolveKey(savedToken, userId).then(token => {
          if (active) {
            setGithubTokenState(token);
          }
        }).catch(err => {
          console.error("Failed to decrypt saved github token:", err);
        });
      } else {
        setGithubTokenState("");
      }
    } else {
      setGithubTokenState("");
    }
    return () => {
      active = false;
    };
  }, [userId]);

  const saveGithubToken = async (token: string) => {
    setGithubTokenState(token);
    if (userId) {
      try {
        const encryptedGithub = await secureKey(token, userId);
        localStorage.setItem("github_pat_token", encryptedGithub);
      } catch (err) {
        console.error("Failed to encrypt github token:", err);
        localStorage.setItem("github_pat_token", token); // Fallback
      }
    } else {
      localStorage.setItem("github_pat_token", token);
    }
  };

  return { githubToken, saveGithubToken };
}
