import { neon } from "@neondatabase/serverless"

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required")
}

const sql = neon(process.env.DATABASE_URL)

export interface User {
  id: number
  email: string
  password_hash: string
  name?: string
  timezone?: string
  language?: string
  created_at: string
  updated_at: string
}

export interface UserCredentials {
  id?: number
  user_id: number
  github_token?: string
  github_username?: string
  vercel_token?: string
  vercel_team_id?: string
  netlify_token?: string
  cloudflare_token?: string
  cloudflare_account_id?: string
  gemini_api_key?: string
  created_at?: string
  updated_at?: string
}

export interface UserSettings {
  id?: number
  user_id: number
  email_notifications?: boolean
  push_notifications?: boolean
  task_updates?: boolean
  deployment_alerts?: boolean
  weekly_reports?: boolean
  theme?: string
  auto_save?: boolean
  code_completion?: boolean
  autonomous_mode?: boolean
  auto_approve?: boolean
  code_quality?: "development" | "staging" | "production"
  created_at?: string
  updated_at?: string
}

export interface Project {
  id: string
  user_id: number
  name: string
  description?: string
  framework: string
  repository: string
  owner: string
  status: "active" | "paused" | "completed"
  progress: number
  deployment_url?: string
  deployment_platform?: "vercel" | "netlify" | "cloudflare"
  last_deployment?: string
  autonomous_mode: boolean
  auto_approve: boolean
  code_quality: "development" | "staging" | "production"
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  project_id: string
  title: string
  description?: string
  status: "pending" | "in-progress" | "completed" | "failed"
  priority: "low" | "medium" | "high"
  type: "ai-generated" | "manual"
  estimated_time?: string
  assigned_agent?: string
  files?: any[]
  dependencies?: string[]
  implementation_details?: any
  created_at: string
  updated_at: string
}

export interface AgentMemory {
  id?: number
  project_id: string
  memory_data?: any
  chat_history?: any[]
  created_at?: string
  updated_at?: string
}

export class DatabaseService {
  // User operations
  async createUser(email: string, passwordHash: string): Promise<User> {
    try {
      const result = await sql`
        INSERT INTO users (email, password_hash)
        VALUES (${email}, ${passwordHash})
        RETURNING *
      `
      return result[0] as User
    } catch (error) {
      console.error("Database createUser error:", error)
      throw new Error("Failed to create user")
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const result = await sql`
        SELECT * FROM users WHERE email = ${email}
      `
      return (result[0] as User) || null
    } catch (error) {
      console.error("Database getUserByEmail error:", error)
      return null
    }
  }

  async getUserById(id: number): Promise<User | null> {
    try {
      const result = await sql`
        SELECT * FROM users WHERE id = ${id}
      `
      return (result[0] as User) || null
    } catch (error) {
      console.error("Database getUserById error:", error)
      return null
    }
  }

  async updateUser(userId: number, updates: Partial<User>): Promise<void> {
    try {
      const fields = Object.keys(updates).filter((key) => key !== "id" && key !== "created_at")
      if (fields.length === 0) return

      const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(", ")
      const values = [userId, ...fields.map((field) => updates[field as keyof User])]

      await sql.unsafe(
        `
        UPDATE users 
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
        values,
      )
    } catch (error) {
      console.error("Database updateUser error:", error)
      throw new Error("Failed to update user")
    }
  }

  // User Settings operations
  async saveUserSettings(userId: number, settings: Partial<UserSettings>): Promise<void> {
    try {
      await sql`
        INSERT INTO user_settings (
          user_id, email_notifications, push_notifications, task_updates, 
          deployment_alerts, weekly_reports, theme, auto_save, code_completion,
          autonomous_mode, auto_approve, code_quality
        )
        VALUES (
          ${userId}, ${settings.email_notifications ?? true}, ${settings.push_notifications ?? false},
          ${settings.task_updates ?? true}, ${settings.deployment_alerts ?? true},
          ${settings.weekly_reports ?? false}, ${settings.theme ?? "light"},
          ${settings.auto_save ?? true}, ${settings.code_completion ?? true},
          ${settings.autonomous_mode ?? true}, ${settings.auto_approve ?? false},
          ${settings.code_quality ?? "production"}
        )
        ON CONFLICT (user_id) DO UPDATE SET
          email_notifications = EXCLUDED.email_notifications,
          push_notifications = EXCLUDED.push_notifications,
          task_updates = EXCLUDED.task_updates,
          deployment_alerts = EXCLUDED.deployment_alerts,
          weekly_reports = EXCLUDED.weekly_reports,
          theme = EXCLUDED.theme,
          auto_save = EXCLUDED.auto_save,
          code_completion = EXCLUDED.code_completion,
          autonomous_mode = EXCLUDED.autonomous_mode,
          auto_approve = EXCLUDED.auto_approve,
          code_quality = EXCLUDED.code_quality,
          updated_at = CURRENT_TIMESTAMP
      `
    } catch (error) {
      console.error("Database saveUserSettings error:", error)
      throw new Error("Failed to save user settings")
    }
  }

  async getUserSettings(userId: number): Promise<UserSettings | null> {
    try {
      const result = await sql`
        SELECT * FROM user_settings WHERE user_id = ${userId}
      `
      return (result[0] as UserSettings) || null
    } catch (error) {
      console.error("Database getUserSettings error:", error)
      return null
    }
  }

  // Credentials operations
  async saveCredentials(userId: number, credentials: Partial<UserCredentials>): Promise<void> {
    try {
      console.log("Saving credentials for user:", userId, "Data keys:", Object.keys(credentials))

      await sql`
        INSERT INTO credentials (
          user_id, github_token, github_username, vercel_token, vercel_team_id,
          netlify_token, cloudflare_token, cloudflare_account_id, gemini_api_key
        )
        VALUES (
          ${userId}, ${credentials.github_token || null}, ${credentials.github_username || null},
          ${credentials.vercel_token || null}, ${credentials.vercel_team_id || null},
          ${credentials.netlify_token || null}, ${credentials.cloudflare_token || null},
          ${credentials.cloudflare_account_id || null}, ${credentials.gemini_api_key || null}
        )
        ON CONFLICT (user_id) DO UPDATE SET
          github_token = COALESCE(EXCLUDED.github_token, credentials.github_token),
          github_username = COALESCE(EXCLUDED.github_username, credentials.github_username),
          vercel_token = COALESCE(EXCLUDED.vercel_token, credentials.vercel_token),
          vercel_team_id = COALESCE(EXCLUDED.vercel_team_id, credentials.vercel_team_id),
          netlify_token = COALESCE(EXCLUDED.netlify_token, credentials.netlify_token),
          cloudflare_token = COALESCE(EXCLUDED.cloudflare_token, credentials.cloudflare_token),
          cloudflare_account_id = COALESCE(EXCLUDED.cloudflare_account_id, credentials.cloudflare_account_id),
          gemini_api_key = COALESCE(EXCLUDED.gemini_api_key, credentials.gemini_api_key),
          updated_at = CURRENT_TIMESTAMP
      `
      console.log("Credentials saved successfully to database")
    } catch (error) {
      console.error("Database saveCredentials error:", error)
      throw new Error("Failed to save credentials")
    }
  }

  async getCredentials(userId: number): Promise<UserCredentials | null> {
    try {
      const result = await sql`
        SELECT * FROM credentials WHERE user_id = ${userId}
      `
      return (result[0] as UserCredentials) || null
    } catch (error) {
      console.error("Database getCredentials error:", error)
      return null
    }
  }

  // Project operations
  async createProject(project: Omit<Project, "created_at" | "updated_at">): Promise<Project> {
    try {
      const result = await sql`
        INSERT INTO projects (
          id, user_id, name, description, framework, repository, owner,
          status, progress, autonomous_mode, auto_approve, code_quality
        )
        VALUES (
          ${project.id}, ${project.user_id}, ${project.name}, ${project.description},
          ${project.framework}, ${project.repository}, ${project.owner},
          ${project.status}, ${project.progress}, ${project.autonomous_mode},
          ${project.auto_approve}, ${project.code_quality}
        )
        RETURNING *
      `
      return result[0] as Project
    } catch (error) {
      console.error("Database createProject error:", error)
      throw new Error("Failed to create project")
    }
  }

  async getProject(projectId: string): Promise<Project | null> {
    try {
      const result = await sql`
        SELECT * FROM projects WHERE id = ${projectId}
      `
      return (result[0] as Project) || null
    } catch (error) {
      console.error("Database getProject error:", error)
      return null
    }
  }

  async getUserProjects(userId: number): Promise<Project[]> {
    try {
      const result = await sql`
        SELECT * FROM projects WHERE user_id = ${userId} ORDER BY created_at DESC
      `
      return result as Project[]
    } catch (error) {
      console.error("Database getUserProjects error:", error)
      return []
    }
  }

  async updateProject(projectId: string, updates: Partial<Project>): Promise<void> {
    try {
      const fields = Object.keys(updates).filter((key) => key !== "id" && key !== "created_at")

      if (fields.length === 0) return

      // Build the SET clause dynamically
      const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(", ")

      const values = [projectId, ...fields.map((field) => updates[field as keyof Project])]

      await sql.unsafe(
        `
        UPDATE projects 
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
        values,
      )
    } catch (error) {
      console.error("Database updateProject error:", error)
      throw new Error("Failed to update project")
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    try {
      await sql`DELETE FROM projects WHERE id = ${projectId}`
    } catch (error) {
      console.error("Database deleteProject error:", error)
      throw new Error("Failed to delete project")
    }
  }

  // Task operations
  async createTask(task: Omit<Task, "created_at" | "updated_at">): Promise<Task> {
    try {
      const result = await sql`
        INSERT INTO tasks (
          id, project_id, title, description, status, priority, type,
          estimated_time, assigned_agent, files, dependencies
        )
        VALUES (
          ${task.id}, ${task.project_id}, ${task.title}, ${task.description},
          ${task.status}, ${task.priority}, ${task.type}, ${task.estimated_time},
          ${task.assigned_agent}, ${JSON.stringify(task.files || [])},
          ${JSON.stringify(task.dependencies || [])}
        )
        RETURNING *
      `
      return result[0] as Task
    } catch (error) {
      console.error("Database createTask error:", error)
      throw new Error("Failed to create task")
    }
  }

  async getProjectTasks(projectId: string): Promise<Task[]> {
    try {
      const result = await sql`
        SELECT * FROM tasks WHERE project_id = ${projectId} ORDER BY created_at DESC
      `
      return result as Task[]
    } catch (error) {
      console.error("Database getProjectTasks error:", error)
      return []
    }
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
    try {
      const fields = Object.keys(updates).filter((key) => key !== "id" && key !== "created_at")

      if (fields.length === 0) return

      const setClause = fields
        .map((field) => {
          const value = updates[field as keyof Task]
          if (field === "files" || field === "dependencies" || field === "implementation_details") {
            return `${field} = '${JSON.stringify(value)}'`
          }
          return `${field} = '${value}'`
        })
        .join(", ")

      await sql.unsafe(`
        UPDATE tasks 
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP
        WHERE id = '${taskId}'
      `)
    } catch (error) {
      console.error("Database updateTask error:", error)
      throw new Error("Failed to update task")
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    try {
      await sql`DELETE FROM tasks WHERE id = ${taskId}`
    } catch (error) {
      console.error("Database deleteTask error:", error)
      throw new Error("Failed to delete task")
    }
  }

  // Agent memory operations
  async saveAgentMemory(projectId: string, memoryData: any, chatHistory?: any[]): Promise<void> {
    try {
      await sql`
        INSERT INTO agent_memory (project_id, memory_data, chat_history)
        VALUES (${projectId}, ${JSON.stringify(memoryData)}, ${JSON.stringify(chatHistory || [])})
        ON CONFLICT (project_id) DO UPDATE SET
          memory_data = EXCLUDED.memory_data,
          chat_history = EXCLUDED.chat_history,
          updated_at = CURRENT_TIMESTAMP
      `
    } catch (error) {
      console.error("Database saveAgentMemory error:", error)
      throw new Error("Failed to save agent memory")
    }
  }

  async getAgentMemory(projectId: string): Promise<AgentMemory | null> {
    try {
      const result = await sql`
        SELECT * FROM agent_memory WHERE project_id = ${projectId}
      `
      return (result[0] as AgentMemory) || null
    } catch (error) {
      console.error("Database getAgentMemory error:", error)
      return null
    }
  }
}

export const db = new DatabaseService()
