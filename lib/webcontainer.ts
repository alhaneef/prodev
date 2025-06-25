import { WebContainer } from "@webcontainer/api"

export interface WebContainerManager {
  container: WebContainer | null
  isBooting: boolean
  isReady: boolean
  sessionId: string
}

export class WebContainerService {
  private static instance: WebContainerService
  private containers: Map<string, WebContainerManager> = new Map()
  private sessionCount = 0
  private readonly MAX_SESSIONS = 20000 // Leave buffer from 25k limit

  private constructor() {}

  static getInstance(): WebContainerService {
    if (!WebContainerService.instance) {
      WebContainerService.instance = new WebContainerService()
    }
    return WebContainerService.instance
  }

  async getContainer(projectId: string): Promise<WebContainerManager> {
    if (this.containers.has(projectId)) {
      return this.containers.get(projectId)!
    }

    // Check session limit
    if (this.sessionCount >= this.MAX_SESSIONS) {
      throw new Error("WebContainer session limit reached. Please try again later.")
    }

    const manager: WebContainerManager = {
      container: null,
      isBooting: true,
      isReady: false,
      sessionId: `session_${Date.now()}_${projectId}`,
    }

    this.containers.set(projectId, manager)
    this.sessionCount++

    try {
      // Boot WebContainer
      manager.container = await WebContainer.boot()
      manager.isBooting = false
      manager.isReady = true

      // Set up cleanup on container disposal
      manager.container.on("error", (error) => {
        console.error(`WebContainer error for project ${projectId}:`, error)
        this.cleanupContainer(projectId)
      })

      return manager
    } catch (error) {
      manager.isBooting = false
      this.cleanupContainer(projectId)
      throw error
    }
  }

  async mountFiles(projectId: string, files: Record<string, any>): Promise<void> {
    const manager = await this.getContainer(projectId)
    if (!manager.container) {
      throw new Error("WebContainer not available")
    }

    await manager.container.mount(files)
  }

  async writeFile(projectId: string, path: string, content: string): Promise<void> {
    const manager = await this.getContainer(projectId)
    if (!manager.container) {
      throw new Error("WebContainer not available")
    }

    await manager.container.fs.writeFile(path, content)
  }

  async readFile(projectId: string, path: string): Promise<string> {
    const manager = await this.getContainer(projectId)
    if (!manager.container) {
      throw new Error("WebContainer not available")
    }

    return await manager.container.fs.readFile(path, "utf-8")
  }

  async executeCommand(projectId: string, command: string, args: string[] = []): Promise<any> {
    const manager = await this.getContainer(projectId)
    if (!manager.container) {
      throw new Error("WebContainer not available")
    }

    const process = await manager.container.spawn(command, args)
    return process
  }

  async startDevServer(projectId: string): Promise<string> {
    const manager = await this.getContainer(projectId)
    if (!manager.container) {
      throw new Error("WebContainer not available")
    }

    // Install dependencies first
    const installProcess = await manager.container.spawn("npm", ["install"])
    await installProcess.exit

    // Start dev server
    const devProcess = await manager.container.spawn("npm", ["run", "dev"])

    // Wait for server to be ready and get URL
    manager.container.on("server-ready", (port, url) => {
      console.log(`Dev server ready on port ${port}: ${url}`)
    })

    // Return the preview URL
    return `https://${manager.sessionId}.webcontainer.io`
  }

  cleanupContainer(projectId: string): void {
    const manager = this.containers.get(projectId)
    if (manager?.container) {
      manager.container.teardown()
      this.sessionCount--
    }
    this.containers.delete(projectId)
  }

  // Session management to prevent hitting limits
  async optimizeSessionUsage(): Promise<void> {
    // Clean up inactive containers
    const inactiveThreshold = 30 * 60 * 1000 // 30 minutes
    const now = Date.now()

    for (const [projectId, manager] of this.containers.entries()) {
      const sessionAge = now - Number.parseInt(manager.sessionId.split("_")[1])
      if (sessionAge > inactiveThreshold) {
        this.cleanupContainer(projectId)
      }
    }
  }

  getSessionStats(): { active: number; limit: number; remaining: number } {
    return {
      active: this.sessionCount,
      limit: this.MAX_SESSIONS,
      remaining: this.MAX_SESSIONS - this.sessionCount,
    }
  }
}
