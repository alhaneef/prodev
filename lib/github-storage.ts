import type { GitHubService, GitHubFile } from "./github-service"

export interface Task {
  id: string
  title: string
  description: string
  status: "pending" | "in-progress" | "completed" | "failed"
  priority: "low" | "medium" | "high"
  type: "ai-generated" | "manual"
  estimatedTime: string
  createdAt: string
  updatedAt: string
  files?: string[]
  dependencies?: string[]
  subtasks?: Task[]
  parentTaskId?: string
  operations?: Array<"create" | "read" | "update" | "delete">
  context?: string
  acceptanceCriteria?: string[]
  technicalNotes?: string
}

export interface ProjectMetadata {
  name: string
  description: string
  framework: string
  progress: number
  status: string
  createdAt: string
  updatedAt: string
}

export interface AgentMemory {
  projectId: string
  conversationHistory: any[]
  taskHistory: Task[]
  codeContext: any[]
  learnings: Record<string, any>
  currentFocus: string
  lastUpdate: string
  fileCache: Record<string, any>
  codebaseIndex: any
  userPreferences: any
  projectInsights: any
}

export class GitHubStorageService {
  private github: GitHubService
  private owner: string
  private repo: string
  private fileCache: Map<string, { content: string; sha: string; lastModified: string }> = new Map()

  constructor(github: GitHubService, owner: string, repo: string) {
    this.github = github
    this.owner = owner
    this.repo = repo
    console.log("GitHubStorageService - Initialized for:", `${owner}/${repo}`)
  }

  async ensureRepository(): Promise<void> {
    try {
      await this.github.getRepository(this.owner, this.repo)
      console.log("GitHubStorageService - Repository exists")
    } catch (error) {
      console.log("GitHubStorageService - Repository doesn't exist, creating...")
      await this.github.createRepository(this.repo, "ProDev project repository", false)

      // Initialize with basic structure
      await this.github.createFile(
        this.owner,
        this.repo,
        ".prodev/config.json",
        JSON.stringify(
          {
            version: "1.0.0",
            platform: "prodev",
            createdAt: new Date().toISOString(),
          },
          null,
          2,
        ),
        "Initialize ProDev configuration",
      )
      console.log("GitHubStorageService - Repository created and initialized")
    }
  }

  async getAllFiles(): Promise<GitHubFile[]> {
    try {
      await this.ensureRepository()
      console.log("GitHubStorageService - Getting all files")
      const files = await this.github.getAllRepositoryFiles(this.owner, this.repo)
      console.log("GitHubStorageService - Found", files.length, "files")

      // Cache file metadata
      for (const file of files) {
        if (file.type === "file") {
          this.fileCache.set(file.path, {
            content: "", // Will be loaded on demand
            sha: file.sha,
            lastModified: new Date().toISOString(),
          })
        }
      }

      return files
    } catch (error) {
      console.error("GitHubStorageService - Error getting all files:", error)
      return []
    }
  }

  async getFileContent(filePath: string): Promise<string> {
    try {
      await this.ensureRepository()
      console.log("GitHubStorageService - Getting file content:", filePath)

      // Check cache first
      const cached = this.fileCache.get(filePath)
      if (cached && cached.content) {
        console.log("GitHubStorageService - Returning cached content for:", filePath)
        return cached.content
      }

      const fileData = await this.github.getFileContent(this.owner, this.repo, filePath)

      // Update cache
      this.fileCache.set(filePath, {
        content: fileData.content,
        sha: fileData.sha,
        lastModified: new Date().toISOString(),
      })

      console.log("GitHubStorageService - File content loaded:", filePath, "Length:", fileData.content.length)
      return fileData.content
    } catch (error) {
      console.error(`GitHubStorageService - Error getting file content for ${filePath}:`, error)
      return ""
    }
  }

  async saveFileContent(filePath: string, content: string, message?: string): Promise<void> {
    try {
      await this.ensureRepository()
      console.log("GitHubStorageService - Saving file content:", filePath)

      const cached = this.fileCache.get(filePath)
      const commitMessage = message || `Update ${filePath}`

      if (cached && cached.sha) {
        // Update existing file
        console.log("GitHubStorageService - Updating existing file:", filePath)
        await this.github.updateFile(this.owner, this.repo, filePath, content, commitMessage, cached.sha)
      } else {
        // Create new file
        console.log("GitHubStorageService - Creating new file:", filePath)
        await this.github.createFile(this.owner, this.repo, filePath, content, commitMessage)
      }

      // Update cache
      this.fileCache.set(filePath, {
        content,
        sha: "", // Will be updated on next fetch
        lastModified: new Date().toISOString(),
      })

      console.log("GitHubStorageService - File saved successfully:", filePath)
    } catch (error) {
      console.error(`GitHubStorageService - Error saving file ${filePath}:`, error)
      throw error
    }
  }

  async getTasks(): Promise<Task[]> {
    try {
      console.log("GitHubStorageService - Getting tasks")
      const content = await this.getFileContent(".prodev/tasks.json")
      if (!content) {
        console.log("GitHubStorageService - No tasks file found, returning empty array")
        return []
      }
      const tasks = JSON.parse(content)
      console.log("GitHubStorageService - Found", tasks.length, "tasks")
      return Array.isArray(tasks) ? tasks : []
    } catch (error) {
      console.log("GitHubStorageService - No tasks file found or invalid JSON, returning empty array")
      return []
    }
  }

  async saveTasks(tasks: Task[]): Promise<void> {
    console.log("GitHubStorageService - Saving", tasks.length, "tasks")
    const content = JSON.stringify(tasks, null, 2)
    await this.saveFileContent(".prodev/tasks.json", content, "Update tasks")
  }

  async createTask(task: Task): Promise<void> {
    console.log("GitHubStorageService - Creating task:", task.id)
    const tasks = await this.getTasks()
    tasks.push(task)
    await this.saveTasks(tasks)
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
    console.log("GitHubStorageService - Updating task:", taskId)
    const tasks = await this.getTasks()
    const taskIndex = tasks.findIndex((t) => t.id === taskId)
    if (taskIndex !== -1) {
      tasks[taskIndex] = { ...tasks[taskIndex], ...updates, updatedAt: new Date().toISOString() }
      await this.saveTasks(tasks)
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    console.log("GitHubStorageService - Deleting task:", taskId)
    const tasks = await this.getTasks()
    const filteredTasks = tasks.filter((t) => t.id !== taskId)
    await this.saveTasks(filteredTasks)
  }

  async getProjectMetadata(): Promise<ProjectMetadata | null> {
    try {
      const content = await this.getFileContent(".prodev/metadata.json")
      if (!content) {
        return null
      }
      return JSON.parse(content)
    } catch (error) {
      return null
    }
  }

  async saveProjectMetadata(metadata: ProjectMetadata): Promise<void> {
    const content = JSON.stringify(metadata, null, 2)
    await this.saveFileContent(".prodev/metadata.json", content, "Update project metadata")
  }

  async getAgentMemory(): Promise<AgentMemory | null> {
    try {
      const content = await this.getFileContent(".prodev/agent-memory.json")
      if (!content) {
        return null
      }
      return JSON.parse(content)
    } catch (error) {
      return null
    }
  }

  async saveAgentMemory(memory: AgentMemory): Promise<void> {
    const content = JSON.stringify(memory, null, 2)
    await this.saveFileContent(".prodev/agent-memory.json", content, "Update agent memory")
  }

  async saveDeploymentLog(log: any): Promise<void> {
    try {
      const existingLogs = await this.getFileContent(".prodev/deployment-logs.json")
      let logs = []

      if (existingLogs) {
        logs = JSON.parse(existingLogs)
      }

      logs.push(log)

      // Keep only last 100 logs
      if (logs.length > 100) {
        logs = logs.slice(-100)
      }

      await this.saveFileContent(
        ".prodev/deployment-logs.json",
        JSON.stringify(logs, null, 2),
        "Update deployment logs",
      )
    } catch (error) {
      console.error("Error saving deployment log:", error)
    }
  }

  async updateFileContent(filePath: string, content: string, message: string): Promise<void> {
    await this.saveFileContent(filePath, content, message)
  }
}
