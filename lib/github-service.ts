export interface GitHubFile {
  name: string
  path: string
  sha: string
  size: number
  type: "file" | "dir"
  content?: string
  encoding?: string
  download_url?: string
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

  async getAllRepositoryFiles(owner: string, repo: string, path = ""): Promise<GitHubFile[]> {
    try {
      const allFiles: GitHubFile[] = []

      const getFilesRecursively = async (currentPath: string): Promise<void> => {
        try {
          const contents = await this.request(`/repos/${owner}/${repo}/contents/${currentPath}`)
          const items = Array.isArray(contents) ? contents : [contents]

          for (const item of items) {
            allFiles.push({
              name: item.name,
              path: item.path,
              sha: item.sha,
              size: item.size || 0,
              type: item.type,
              download_url: item.download_url,
            })

            // If it's a directory, recursively get its contents
            if (item.type === "dir") {
              await getFilesRecursively(item.path)
            }
          }
        } catch (error) {
          console.error(`Error getting contents of ${currentPath}:`, error)
        }
      }

      await getFilesRecursively(path)
      return allFiles
    } catch (error) {
      console.error("Error getting all repository files:", error)
      return []
    }
  }

  async getFileContent(owner: string, repo: string, path: string): Promise<{ content: string; sha: string }> {
    const response = await this.request(`/repos/${owner}/${repo}/contents/${path}`)

    if (response.type !== "file") {
      throw new Error(`${path} is not a file`)
    }

    let content = ""
    if (response.content) {
      if (response.encoding === "base64") {
        content = atob(response.content.replace(/\n/g, ""))
      } else {
        content = response.content
      }
    } else if (response.download_url) {
      // For large files, GitHub provides a download URL
      const fileResponse = await fetch(response.download_url)
      content = await fileResponse.text()
    }

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
        content: btoa(unescape(encodeURIComponent(content))),
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
        content: btoa(unescape(encodeURIComponent(content))),
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

  async getUser(): Promise<any> {
    return this.request("/user")
  }

  async getUserRepositories(): Promise<any[]> {
    return this.request("/user/repos?sort=updated&per_page=100")
  }
}
