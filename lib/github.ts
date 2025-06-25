export interface GitHubFile {
  name: string
  path: string
  sha: string
  size: number
  url: string
  html_url: string
  git_url: string
  download_url: string
  type: "file" | "dir"
  content?: string
  encoding?: string
}

export class GitHubService {
  private token: string
  private baseUrl = "https://api.github.com"

  constructor(token: string) {
    this.token = token
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`GitHub API error: ${response.status} ${error}`)
    }

    return response.json()
  }

  async getRepository(owner: string, repo: string): Promise<any> {
    return this.request(`/repos/${owner}/${repo}`)
  }

  async createRepository(name: string, description: string, isPrivate = false): Promise<any> {
    return this.request("/user/repos", {
      method: "POST",
      body: JSON.stringify({
        name,
        description,
        private: isPrivate,
        auto_init: true,
      }),
    })
  }

  async getRepositoryContents(owner: string, repo: string, path = "", recursive = false): Promise<GitHubFile[]> {
    try {
      const contents = await this.request(`/repos/${owner}/${repo}/contents/${path}`)

      if (!Array.isArray(contents)) {
        return [contents]
      }

      let allFiles: GitHubFile[] = contents

      if (recursive) {
        // Get contents of all directories recursively
        const directories = contents.filter((item: GitHubFile) => item.type === "dir")

        for (const dir of directories) {
          try {
            const subContents = await this.getRepositoryContents(owner, repo, dir.path, true)
            allFiles = allFiles.concat(subContents)
          } catch (error) {
            console.error(`Error getting contents of directory ${dir.path}:`, error)
          }
        }
      }

      return allFiles
    } catch (error) {
      console.error(`Error getting repository contents for ${path}:`, error)
      return []
    }
  }

  async getFileContent(owner: string, repo: string, path: string): Promise<{ content: string; sha: string }> {
    const response = await this.request(`/repos/${owner}/${repo}/contents/${path}`)

    if (response.type !== "file") {
      throw new Error(`${path} is not a file`)
    }

    const content = response.encoding === "base64" ? atob(response.content.replace(/\n/g, "")) : response.content

    return {
      content,
      sha: response.sha,
    }
  }

  async createFile(owner: string, repo: string, path: string, content: string, message: string): Promise<any> {
    return this.request(`/repos/${owner}/${repo}/contents/${path}`, {
      method: "PUT",
      body: JSON.stringify({
        message,
        content: btoa(content),
      }),
    })
  }

  async updateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    sha: string,
  ): Promise<any> {
    return this.request(`/repos/${owner}/${repo}/contents/${path}`, {
      method: "PUT",
      body: JSON.stringify({
        message,
        content: btoa(content),
        sha,
      }),
    })
  }

  async deleteFile(owner: string, repo: string, path: string, message: string, sha: string): Promise<any> {
    return this.request(`/repos/${owner}/${repo}/contents/${path}`, {
      method: "DELETE",
      body: JSON.stringify({
        message,
        sha,
      }),
    })
  }

  async createBranch(owner: string, repo: string, branchName: string, fromBranch = "main"): Promise<any> {
    // Get the SHA of the source branch
    const refResponse = await this.request(`/repos/${owner}/${repo}/git/refs/heads/${fromBranch}`)
    const sha = refResponse.object.sha

    // Create new branch
    return this.request(`/repos/${owner}/${repo}/git/refs`, {
      method: "POST",
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha,
      }),
    })
  }

  async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    head: string,
    base: string,
    body?: string,
  ): Promise<any> {
    return this.request(`/repos/${owner}/${repo}/pulls`, {
      method: "POST",
      body: JSON.stringify({
        title,
        head,
        base,
        body,
      }),
    })
  }

  async getUser(): Promise<any> {
    return this.request("/user")
  }

  async getUserRepositories(): Promise<any[]> {
    return this.request("/user/repos?sort=updated&per_page=100")
  }
}
