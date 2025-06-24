import { Octokit } from "@octokit/rest"

/**
 * Thin wrapper around Octokit with convenience helpers that the
 * rest of the platform already relies on.
 */
export class GitHubService {
  private octokit: Octokit

  constructor(token: string) {
    if (!token) {
      throw new Error(
        "GitHubService requires a personal-access token. " + "Pass it explicitly or set the GITHUB_TOKEN env var.",
      )
    }
    this.octokit = new Octokit({ auth: token })
  }

  /* ------------------------------------------------------------------ *
   * Repositories                                                        *
   * ------------------------------------------------------------------ */

  async createRepository(name: string, description = "", isPrivate = true) {
    const { data } = await this.octokit.repos.createForAuthenticatedUser({
      name,
      description,
      private: isPrivate,
      auto_init: true,
    })
    return data
  }

  async getRepository(owner: string, repo: string) {
    const { data } = await this.octokit.repos.get({ owner, repo })
    return data
  }

  /* ------------------------------------------------------------------ *
   * Files                                                               *
   * ------------------------------------------------------------------ */

  async createOrUpdateFile(owner: string, repo: string, path: string, content: string, message: string, sha?: string) {
    const { data } = await this.octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message,
      content: Buffer.from(content).toString("base64"),
      sha,
    })
    return data
  }

  async getFileContent(owner: string, repo: string, path: string) {
    const { data } = await this.octokit.repos.getContent({ owner, repo, path })

    if ("content" in data) {
      return {
        content: Buffer.from(data.content, "base64").toString(),
        sha: data.sha,
      }
    }
    throw new Error("File not found")
  }

  async listFiles(owner: string, repo: string, path = "") {
    const { data } = await this.octokit.repos.getContent({ owner, repo, path })
    return Array.isArray(data) ? data : [data]
  }
}
