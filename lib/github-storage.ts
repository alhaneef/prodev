export class GitHubStorageService {
  private github: GitHubService
  private owner: string
  private repo: string
  private basePath = ".prodev"

  constructor(github: GitHubService, owner: string, repo: string) {
    this.github = github
    this.owner = owner
    this.repo = repo
    console.log("GitHubStorageService initialized for:", `${owner}/${repo}`)
  }

  async getTasks(): Promise<Task[]> {
    try {
      console.log("GitHubStorageService - Getting tasks from:", `${this.owner}/${this.repo}`)
      const content = await this.getFileContent("tasks.json")
      if (!content) {
        console.log("GitHubStorageService - No tasks.json found, returning empty array")
        return []
      }
      const tasks = JSON.parse(content)
      console.log("GitHubStorageService - Found", tasks.length, "tasks")
      return Array.isArray(tasks) ? tasks : []
    } catch (error) {
      console.error("GitHubStorageService - Error getting tasks:", error)
      return []
    }
  }

  async saveTask(task: Task): Promise<void> {
    try {
      console.log("GitHubStorageService - Saving task:", task.id)
      const tasks = await this.getTasks()
      const existingIndex = tasks.findIndex((t) => t.id === task.id)

      if (existingIndex >= 0) {
        tasks[existingIndex] = task
      } else {
        tasks.push(task)
      }

      await this.updateFileContent("tasks.json", JSON.stringify(tasks, null, 2), `Save task: ${task.title}`)
      console.log("GitHubStorageService - Task saved successfully")
    } catch (error) {
      console.error("GitHubStorageService - Error saving task:", error)
      throw error
    }
  }

  private async getFileContent(path: string): Promise<string | null> {
    try {
      const fullPath = `${this.basePath}/${path}`
      const result = await this.github.getFileContent(this.owner, this.repo, fullPath)
      return result.content
    } catch (error) {
      console.log(`GitHubStorageService - File ${path} not found or error:`, error)
      return null
    }
  }

  async updateFileContent(path: string, content: string, message: string): Promise<void> {
    try {
      const fullPath = `${this.basePath}/${path}`
      console.log("GitHubStorageService - Updating file:", fullPath)

      try {
        // Try to get existing file
        const existing = await this.github.getFileContent(this.owner, this.repo, fullPath)
        await this.github.updateFile(this.owner, this.repo, fullPath, content, message, existing.sha)
      } catch (error) {
        // File doesn't exist, create it
        await this.github.createFile(this.owner, this.repo, fullPath, content, message)
      }

      console.log("GitHubStorageService - File updated successfully")
    } catch (error) {
      console.error("GitHubStorageService - Error updating file:", error)
      throw error
    }
  }
}
