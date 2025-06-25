import type { GitHubService } from "./github"

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

  constructor(github: GitHubService, owner: string, repo: string) {
    this.github = github
    this.owner = owner
    this.repo = repo
  }

  async ensureRepository(): Promise<void> {
    try {
      await this.github.getRepository(this.owner, this.repo)
    } catch (error) {
      // Repository doesn't exist, create it
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

  async getTasks(): Promise<Task[]> {
    try {
      await this.ensureRepository()
      const content = await this.github.getFileContent(this.owner, this.repo, ".prodev/tasks.json")
      return JSON.parse(content.content)
    } catch (error) {
      console.log("No tasks file found, returning empty array")
      return []
    }
  }

  async saveTasks(tasks: Task[]): Promise<void> {
    try {
      await this.ensureRepository()
      const content = JSON.stringify(tasks, null, 2)

      try {
        // Try to update existing file
        const existingFile = await this.github.getFileContent(this.owner, this.repo, ".prodev/tasks.json")
        await this.github.updateFile(
          this.owner,
          this.repo,
          ".prodev/tasks.json",
          content,
          "Update tasks",
          existingFile.sha,
        )
      } catch (error) {
        // File doesn't exist, create it
        await this.github.createFile(this.owner, this.repo, ".prodev/tasks.json", content, "Create tasks file")
      }
    } catch (error) {
      console.error("Error saving tasks:", error)
      throw error
    }
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
      tasks[taskIndex] = { ...tasks[taskIndex], ...updates }
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
      await this.ensureRepository()
      const content = await this.github.getFileContent(this.owner, this.repo, ".prodev/metadata.json")
      return JSON.parse(content.content)
    } catch (error) {
      return null
    }
  }

  async saveProjectMetadata(metadata: ProjectMetadata): Promise<void> {
    try {
      await this.ensureRepository()
      const content = JSON.stringify(metadata, null, 2)

      try {
        const existingFile = await this.github.getFileContent(this.owner, this.repo, ".prodev/metadata.json")
        await this.github.updateFile(
          this.owner,
          this.repo,
          ".prodev/metadata.json",
          content,
          "Update project metadata",
          existingFile.sha,
        )
      } catch (error) {
        await this.github.createFile(this.owner, this.repo, ".prodev/metadata.json", content, "Create project metadata")
      }
    } catch (error) {
      console.error("Error saving project metadata:", error)
      throw error
    }
  }

  async getAgentMemory(): Promise<AgentMemory | null> {
    try {
      await this.ensureRepository()
      const content = await this.github.getFileContent(this.owner, this.repo, ".prodev/agent-memory.json")
      return JSON.parse(content.content)
    } catch (error) {
      return null
    }
  }

  async saveAgentMemory(memory: AgentMemory): Promise<void> {
    try {
      await this.ensureRepository()
      const content = JSON.stringify(memory, null, 2)

      try {
        const existingFile = await this.github.getFileContent(this.owner, this.repo, ".prodev/agent-memory.json")
        await this.github.updateFile(
          this.owner,
          this.repo,
          ".prodev/agent-memory.json",
          content,
          "Update agent memory",
          existingFile.sha,
        )
      } catch (error) {
        await this.github.createFile(this.owner, this.repo, ".prodev/agent-memory.json", content, "Create agent memory")
      }
    } catch (error) {
      console.error("Error saving agent memory:", error)
      throw error
    }
  }

  async getAllFiles(): Promise<any[]> {
    try {
      await this.ensureRepository()
      return await this.github.getRepositoryContents(this.owner, this.repo, "", true) // recursive = true
    } catch (error) {
      console.error("Error getting all files:", error)
      return []
    }
  }

  async getFileContent(filePath: string): Promise<string> {
    try {
      await this.ensureRepository()
      const content = await this.github.getFileContent(this.owner, this.repo, filePath)
      return content.content
    } catch (error) {
      console.error(`Error getting file content for ${filePath}:`, error)
      return ""
    }
  }

  async saveFileContent(filePath: string, content: string, message?: string): Promise<void> {
    try {
      await this.ensureRepository()

      try {
        const existingFile = await this.github.getFileContent(this.owner, this.repo, filePath)
        await this.github.updateFile(
          this.owner,
          this.repo,
          filePath,
          content,
          message || `Update ${filePath}`,
          existingFile.sha,
        )
      } catch (error) {
        await this.github.createFile(this.owner, this.repo, filePath, content, message || `Create ${filePath}`)
      }
    } catch (error) {
      console.error(`Error saving file ${filePath}:`, error)
      throw error
    }
  }
}
