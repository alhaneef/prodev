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
  }

  async ensureRepository(): Promise<void> {
    try {
      await this.github.getRepository(this.owner, this.repo)
    } catch (error) {
      console.log(`Repository ${this.owner}/${this.repo} doesn't exist, creating...`)
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
    }
  }

  async getAllFiles(): Promise<GitHubFile[]> {
    try {
      await this.ensureRepository()
      const files = await this.github.getAllRepositoryFiles(this.owner, this.repo)

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
      console.error("Error getting all files:", error)
      return []
    }
  }

  async getFileContent(filePath: string): Promise<string> {
    try {
      await this.ensureRepository()

      // Check cache first
      const cached = this.fileCache.get(filePath)
      if (cached && cached.content) {
        return cached.content
      }

      const fileData = await this.github.getFileContent(this.owner, this.repo, filePath)

      // Update cache
      this.fileCache.set(filePath, {
        content: fileData.content,
        sha: fileData.sha,
        lastModified: new Date().toISOString(),
      })

      return fileData.content
    } catch (error) {
      console.error(`Error getting file content for ${filePath}:`, error)
      return ""
    }
  }

  async saveFileContent(filePath: string, content: string, message?: string): Promise<void> {
    try {
      await this.ensureRepository()

      const cached = this.fileCache.get(filePath)
      const commitMessage = message || `Update ${filePath}`

      if (cached && cached.sha) {
        // Update existing file
        await this.github.updateFile(this.owner, this.repo, filePath, content, commitMessage, cached.sha)
      } else {
        // Create new file
        await this.github.createFile(this.owner, this.repo, filePath, content, commitMessage)
      }

      // Update cache
      this.fileCache.set(filePath, {
        content,
        sha: "", // Will be updated on next fetch
        lastModified: new Date().toISOString(),
      })
    } catch (error) {
      console.error(`Error saving file ${filePath}:`, error)
      throw error
    }
  }

  async getTasks(): Promise<Task[]> {
    try {
      const content = await this.getFileContent(".prodev/tasks.json")
      if (!content) {
        return []
      }
      return JSON.parse(content)
    } catch (error) {
      console.log("No tasks file found or invalid JSON, returning empty array")
      return []
    }
  }

  async saveTasks(tasks: Task[]): Promise<void> {
    const content = JSON.stringify(tasks, null, 2)
    await this.saveFileContent(".prodev/tasks.json", content, "Update tasks")
  }

  async createTask(task: Task): Promise<void> {
    const tasks = await this.getTasks()
    tasks.push(task)
    await this.saveTasks(tasks)
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
    const tasks = await this.getTasks()
    const taskIndex = tasks.findIndex((t) => t.id === taskId)
    if (taskIndex !== -1) {
      tasks[taskIndex] = { ...tasks[taskIndex], ...updates, updatedAt: new Date().toISOString() }
      await this.saveTasks(tasks)
    }
  }

  async deleteTask(taskId: string): Promise<void> {
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
}
