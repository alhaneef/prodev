import { GitHubService } from "./github-service"

/**
 * Singleton helper – import { githubStorage } from "@/lib/github"
 * Calling without arguments returns the memoised instance (after it
 * has been initialised once with a token).
 */
let _instance: GitHubService | null = null

export function githubStorage(token?: string) {
  if (!_instance) {
    const finalToken = token ?? process.env.GITHUB_TOKEN ?? ""
    _instance = new GitHubService(finalToken)
  }
  return _instance
}

/* Re-export GitHubService for callers that want to instantiate
   their own client. */
export { GitHubService } from "./github-service"
