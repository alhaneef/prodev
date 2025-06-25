import { WebContainer } from "@webcontainer/api"

export interface WebContainerSession {
  container: WebContainer | null
  isBooting: boolean
  isReady: boolean
  sessionId: string
  lastActivity: number
  projectId: string
}

export class WebContainerManager {
  private static instance: WebContainerManager
  private sessions: Map<string, WebContainerSession> = new Map()
  private sessionCount = 0
  private readonly MAX_SESSIONS = 15 // Conservative limit to avoid hitting 25k/month
  private readonly SESSION_TIMEOUT = 20 * 60 * 1000 // 20 minutes
  private cleanupInterval: NodeJS.Timeout | null = null

  private constructor() {
    this.startCleanupInterval()
  }

  static getInstance(): WebContainerManager {
    if (!WebContainerManager.instance) {
      WebContainerManager.instance = new WebContainerManager()
    }
    return WebContainerManager.instance
  }

  private startCleanupInterval() {
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupInactiveSessions()
      },
      5 * 60 * 1000,
    ) // Check every 5 minutes
  }

  private cleanupInactiveSessions() {
    const now = Date.now()
    for (const [projectId, session] of this.sessions.entries()) {
      if (now - session.lastActivity > this.SESSION_TIMEOUT) {
        console.log(`Cleaning up inactive session for project ${projectId}`)
        this.destroySession(projectId)
      }
    }
  }

  async getSession(projectId: string): Promise<WebContainerSession> {
    // Update activity timestamp
    const existingSession = this.sessions.get(projectId)
    if (existingSession) {
      existingSession.lastActivity = Date.now()
      return existingSession
    }

    // Check session limit
    if (this.sessionCount >= this.MAX_SESSIONS) {
      // Try to clean up inactive sessions first
      this.cleanupInactiveSessions()

      if (this.sessionCount >= this.MAX_SESSIONS) {
        throw new Error(`WebContainer session limit reached (${this.MAX_SESSIONS}). Please try again later.`)
      }
    }

    // Create new session
    const session: WebContainerSession = {
      container: null,
      isBooting: true,
      isReady: false,
      sessionId: `wc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      lastActivity: Date.now(),
      projectId,
    }

    this.sessions.set(projectId, session)
    this.sessionCount++

    try {
      console.log(`Booting WebContainer for project ${projectId}...`)
      session.container = await WebContainer.boot()
      session.isBooting = false
      session.isReady = true
      console.log(`WebContainer ready for project ${projectId}`)
    } catch (error) {
      console.error(`Failed to boot WebContainer for project ${projectId}:`, error)
      session.isBooting = false
      this.destroySession(projectId)
      throw error
    }

    return session
  }

  updateActivity(projectId: string) {
    const session = this.sessions.get(projectId)
    if (session) {
      session.lastActivity = Date.now()
    }
  }

  destroySession(projectId: string) {
    const session = this.sessions.get(projectId)
    if (session?.container) {
      try {
        session.container.teardown()
      } catch (error) {
        console.error(`Error tearing down WebContainer for project ${projectId}:`, error)
      }
    }
    this.sessions.delete(projectId)
    this.sessionCount = Math.max(0, this.sessionCount - 1)
  }

  getSessionStats() {
    return {
      active: this.sessionCount,
      limit: this.MAX_SESSIONS,
      remaining: this.MAX_SESSIONS - this.sessionCount,
      sessions: Array.from(this.sessions.entries()).map(([projectId, session]) => ({
        projectId,
        sessionId: session.sessionId,
        isReady: session.isReady,
        lastActivity: new Date(session.lastActivity).toISOString(),
      })),
    }
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }

    for (const projectId of this.sessions.keys()) {
      this.destroySession(projectId)
    }
  }
}
