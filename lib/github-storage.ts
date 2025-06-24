import type { GitHubService } from "./github"

export interface AgentMemory {
  projectId: string
  conversationHistory: Array<{ role: string; content: string; timestamp: string }>
  taskHistory: any[]
  codeContext: Array<{ path: string; content: string }>
  learnings: Record<string, any>
  currentFocus: string
  lastUpdate: string
  fileCache: Record<string, { content: string; lastModified: string }>
}

export interface ProjectMetadata {
  id: string
  name: string
  description: string
  framework: string
  progress: number
  status: string
  created_at: string
  updated_at: string
  tasks?: any[]
  sprints?: any[]
}

export class GitHubStorageService {
  private github: GitHubService
  private owner: string
  private repo: string
  private fileCache: Map<string, { content: string; lastModified: string }> = new Map()

  constructor(github: GitHubService, owner: string, repo: string) {
    this.github = github
    this.owner = owner
    this.repo = repo
    this.loadCacheFromStorage()
  }

  private loadCacheFromStorage() {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem(`prodev_cache_${this.owner}_${this.repo}`)
      if (cached) {
        try {
          const parsedCache = JSON.parse(cached)
          this.fileCache = new Map(Object.entries(parsedCache))
        } catch (error) {
          console.error("Error loading cache:", error)
        }
      }
    }
  }

  private saveCacheToStorage() {
    if (typeof window !== "undefined") {
      const cacheObj = Object.fromEntries(this.fileCache)
      localStorage.setItem(`prodev_cache_${this.owner}_${this.repo}`, JSON.stringify(cacheObj))
    }
  }

  async getFileContent(path: string, useCache = true): Promise<string> {
    if (useCache && this.fileCache.has(path)) {
      return this.fileCache.get(path)!.content
    }

    try {
      const fileContent = await this.github.getFileContent(this.owner, this.repo, path)
      this.fileCache.set(path, {
        content: fileContent.content,
        lastModified: new Date().toISOString(),
      })
      this.saveCacheToStorage()
      return fileContent.content
    } catch (error) {
      console.error(`Error getting file content for ${path}:`, error)
      throw error
    }
  }

  async updateFileContent(path: string, content: string, message: string): Promise<void> {
    try {
      const existingFile = await this.github.getFileContent(this.owner, this.repo, path)
      await this.github.updateFile(this.owner, this.repo, path, content, message, existingFile.sha)

      // Update cache
      this.fileCache.set(path, {
        content: content,
        lastModified: new Date().toISOString(),
      })
      this.saveCacheToStorage()
    } catch (error) {
      // File doesn't exist, create it
      await this.github.createFile(this.owner, this.repo, path, content, message)
      this.fileCache.set(path, {
        content: content,
        lastModified: new Date().toISOString(),
      })
      this.saveCacheToStorage()
    }
  }

  async refreshCache(): Promise<void> {
    try {
      const files = await this.github.listFiles(this.owner, this.repo)
      this.fileCache.clear()

      for (const file of files) {
        if (file.type === "file") {
          try {
            const content = await this.github.getFileContent(this.owner, this.repo, file.path)
            this.fileCache.set(file.path, {
              content: content.content,
              lastModified: new Date().toISOString(),
            })
          } catch (error) {
            console.error(`Error caching file ${file.path}:`, error)
          }
        }
      }

      this.saveCacheToStorage()
    } catch (error) {
      console.error("Error refreshing cache:", error)
    }
  }

  // Task Management in GitHub
  async getTasks(): Promise<any[]> {
    try {
      const content = await this.getFileContent(".prodev/tasks.json")
      return JSON.parse(content)
    } catch (error) {
      return []
    }
  }

  async saveTasks(tasks: any[]): Promise<void> {
    const content = JSON.stringify(tasks, null, 2)
    await this.updateFileContent(".prodev/tasks.json", content, "📋 Update tasks")
  }

  async createTask(task: any): Promise<void> {
    const tasks = await this.getTasks()
    tasks.push(task)
    await this.saveTasks(tasks)
  }

  async updateTask(taskId: string, updates: any): Promise<void> {
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

  // Agent Memory in GitHub with Cache
  async getAgentMemory(): Promise<AgentMemory | null> {
    try {
      const content = await this.getFileContent(".prodev/agent-memory.json")
      const memory = JSON.parse(content)
      memory.fileCache = Object.fromEntries(this.fileCache)
      return memory
    } catch (error) {
      return {
        projectId: "",
        conversationHistory: [],
        taskHistory: [],
        codeContext: [],
        learnings: {},
        currentFocus: "Development",
        lastUpdate: new Date().toISOString(),
        fileCache: Object.fromEntries(this.fileCache),
      }
    }
  }

  async saveAgentMemory(memory: AgentMemory): Promise<void> {
    const content = JSON.stringify(memory, null, 2)
    await this.updateFileContent(".prodev/agent-memory.json", content, "🧠 Update agent memory")
  }

  // Project Metadata
  async getProjectMetadata(): Promise<ProjectMetadata | null> {
    try {
      const content = await this.getFileContent(".prodev/project.json")
      return JSON.parse(content)
    } catch (error) {
      return null
    }
  }

  async saveProjectMetadata(metadata: ProjectMetadata): Promise<void> {
    const content = JSON.stringify(metadata, null, 2)
    await this.updateFileContent(".prodev/project.json", content, "📊 Update project metadata")
  }
}
