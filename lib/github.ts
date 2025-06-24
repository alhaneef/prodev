import { Octokit } from "@octokit/rest"

export class GitHubService {
  private octokit: Octokit

  constructor(token: string) {
    this.octokit = new Octokit({
      auth: token,
    })
  }

  async createRepository(name: string, description: string, isPrivate = true) {
    try {
      const response = await this.octokit.repos.createForAuthenticatedUser({
        name,
        description,
        private: isPrivate,
        auto_init: true,
      })
      return response.data
    } catch (error) {
      console.error("Error creating repository:", error)
      throw error
    }
  }

  async getRepository(owner: string, repo: string) {
    try {
      const response = await this.octokit.repos.get({
        owner,
        repo,
      })
      return response.data
    } catch (error) {
      console.error("Error fetching repository:", error)
      throw error
    }
  }

  async createFile(owner: string, repo: string, path: string, content: string, message: string) {
    try {
      const response = await this.octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message,
        content: Buffer.from(content).toString("base64"),
      })
      return response.data
    } catch (error) {
      console.error("Error creating file:", error)
      throw error
    }
  }

  async getFileContent(owner: string, repo: string, path: string) {
    try {
      const response = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
      })

      if ("content" in response.data) {
        return {
          content: Buffer.from(response.data.content, "base64").toString(),
          sha: response.data.sha,
        }
      }
      throw new Error("File not found")
    } catch (error) {
      console.error("Error fetching file:", error)
      throw error
    }
  }

  async updateFile(owner: string, repo: string, path: string, content: string, message: string, sha: string) {
    try {
      const response = await this.octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message,
        content: Buffer.from(content).toString("base64"),
        sha,
      })
      return response.data
    } catch (error) {
      console.error("Error updating file:", error)
      throw error
    }
  }

  async listFiles(owner: string, repo: string, path = "") {
    try {
      const response = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
      })
      return Array.isArray(response.data) ? response.data : [response.data]
    } catch (error) {
      console.error("Error listing files:", error)
      throw error
    }
  }
}
