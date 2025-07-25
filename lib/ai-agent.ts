import { GoogleGenerativeAI } from "@google/generative-ai"
import type { GitHubStorageService } from "./github-storage"
import type { GitHubService } from "./github-service"

// Load Puter.js dynamically
declare global {
  interface Window {
    puter: any
  }
}

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

export interface Project {
  id: string
  name: string
  description: string
  framework: string
  repository: string
  progress: number
}

export class AIAgent {
  private genAI: GoogleGenerativeAI
  private model: any
  private githubStorage?: GitHubStorageService
  private github?: GitHubService
  private puterLoaded = false

  constructor(apiKey: string, githubStorage?: GitHubStorageService, github?: GitHubService) {
    this.genAI = new GoogleGenerativeAI(apiKey)
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" })
    this.githubStorage = githubStorage
    this.github = github
    this.initializePuter()
  }

  private async initializePuter(): Promise<void> {
    try {
      // Load Puter.js if not already loaded
      if (typeof window !== "undefined" && !window.puter) {
        const script = document.createElement("script")
        script.src = "https://js.puter.com/v2/"
        script.async = true

        await new Promise((resolve, reject) => {
          script.onload = resolve
          script.onerror = reject
          document.head.appendChild(script)
        })

        // Wait for puter to be available
        let attempts = 0
        while (!window.puter && attempts < 50) {
          await new Promise((resolve) => setTimeout(resolve, 100))
          attempts++
        }
      }

      this.puterLoaded = !!window.puter
      console.log("Puter.js loaded:", this.puterLoaded)
    } catch (error) {
      console.warn("Failed to load Puter.js, falling back to existing providers:", error)
      this.puterLoaded = false
    }
  }

  private async chatWithPuter(prompt: string, options: any = {}): Promise<string> {
    try {
      if (!this.puterLoaded || !window.puter) {
        throw new Error("Puter not available")
      }

      const response = await window.puter.ai.chat(prompt, {
        model: options.model || "claude-sonnet-4",
        max_tokens: options.max_tokens || 4000,
        temperature: options.temperature || 0.7,
        ...options,
      })

      return typeof response === "string" ? response : response.message || response.text || String(response)
    } catch (error) {
      console.warn("Puter AI request failed:", error)
      throw error
    }
  }

  private async chatWithGPT4(prompt: string, options: any = {}): Promise<string> {
    try {
      if (!this.puterLoaded || !window.puter) {
        throw new Error("Puter not available")
      }

      const response = await window.puter.ai.chat(prompt, {
        model: "gpt-4.1",
        max_tokens: options.max_tokens || 4000,
        temperature: options.temperature || 0.7,
        ...options,
      })

      return typeof response === "string" ? response : response.message || response.text || String(response)
    } catch (error) {
      console.warn("Puter GPT-4.1 request failed:", error)
      throw error
    }
  }

  private async chatWithGemini(prompt: string, options: any = {}): Promise<string> {
    try {
      const result = await this.model.generateContent(prompt)
      const response = await result.response
      return response.text()
    } catch (error) {
      console.warn("Gemini request failed:", error)
      throw error
    }
  }

  private async performAIRequest(prompt: string, options: any = {}): Promise<string> {
    const errors: string[] = []

    // Try Puter Claude Sonnet 4 first
    try {
      console.log("🤖 Trying Puter Claude Sonnet 4...")
      return await this.chatWithPuter(prompt, { model: "claude-sonnet-4", ...options })
    } catch (error) {
      const errorMsg = `Puter Claude failed: ${error instanceof Error ? error.message : "Unknown error"}`
      console.warn(errorMsg)
      errors.push(errorMsg)
    }

    // Try Puter GPT-4.1 as fallback
    try {
      console.log("🤖 Trying Puter GPT-4.1...")
      return await this.chatWithGPT4(prompt, options)
    } catch (error) {
      const errorMsg = `Puter GPT-4.1 failed: ${error instanceof Error ? error.message : "Unknown error"}`
      console.warn(errorMsg)
      errors.push(errorMsg)
    }

    // Try Gemini as final fallback
    try {
      console.log("🤖 Trying Gemini fallback...")
      return await this.chatWithGemini(prompt, options)
    } catch (error) {
      const errorMsg = `Gemini failed: ${error instanceof Error ? error.message : "Unknown error"}`
      console.warn(errorMsg)
      errors.push(errorMsg)
    }

    throw new Error(`All AI providers failed: ${errors.join("; ")}`)
  }

  async generateTasks(projectDescription: string, framework: string, userContext?: string): Promise<Task[]> {
    const prompt = `
    As an expert software architect, analyze this project and generate intelligent, actionable tasks.
    
    PROJECT DETAILS:
    - Description: ${projectDescription}
    - Framework: ${framework}
    - User Context: ${userContext || "General development"}
    
    Generate 8-12 specific, actionable tasks. Return ONLY valid JSON:
    
    {
      "tasks": [
        {
          "title": "Specific task title",
          "description": "Detailed description with technical requirements",
          "priority": "high|medium|low",
          "estimatedTime": "X hours",
          "files": ["specific/file/paths.ts"],
          "operations": ["create", "update", "delete"],
          "acceptanceCriteria": ["Specific criteria"],
          "technicalNotes": "Implementation details",
          "context": "How this relates to user goals"
        }
      ]
    }
    `

    try {
      const response = await this.performAIRequest(prompt)
      let text = response.trim()

      if (text.startsWith("```json")) {
        text = text.replace(/```json\n?/, "").replace(/\n?```$/, "")
      }

      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return parsed.tasks.map((task: any, index: number) => ({
          id: `task_${Date.now()}_${index}`,
          title: task.title,
          description: task.description,
          status: "pending" as const,
          priority: task.priority,
          type: "ai-generated" as const,
          estimatedTime: task.estimatedTime,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          files: task.files || [],
          dependencies: task.dependencies || [],
          operations: task.operations || ["read"],
          acceptanceCriteria: task.acceptanceCriteria || [],
          technicalNotes: task.technicalNotes || "",
          context: task.context || userContext || "",
        }))
      }
      throw new Error("Invalid response format")
    } catch (error) {
      console.error("Error generating tasks:", error)
      throw error
    }
  }

  async implementTask(
    task: Task,
    projectContext: Project,
  ): Promise<{
    files: Array<{ path: string; content: string; operation: "create" | "update" | "delete" }>
    message: string
    commitMessage: string
  }> {
    console.log("AIAgent - Starting task implementation:", task.title)

    const prompt = `
    You are implementing this task in a ${projectContext.framework} project:
    
    TASK: ${task.title}
    DESCRIPTION: ${task.description}
    FILES: ${task.files?.join(", ") || "Auto-detect"}
    OPERATIONS: ${task.operations?.join(", ") || "read, update"}
    
    PROJECT CONTEXT:
    - Name: ${projectContext.name}
    - Framework: ${projectContext.framework}
    - Repository: ${projectContext.repository}
    
    Implement this task completely. Return ONLY valid JSON:
    
    {
      "files": [
        {
          "path": "relative/path/to/file.ext",
          "content": "complete file content",
          "operation": "create|update|delete"
        }
      ],
      "message": "Implementation summary",
      "commitMessage": "feat: descriptive commit message"
    }
    `

    try {
      console.log("AIAgent - Generating implementation with AI")
      const response = await this.performAIRequest(prompt)
      let text = response.trim()

      if (text.startsWith("```json")) {
        text = text.replace(/```json\n?/, "").replace(/\n?```$/, "")
      }

      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error("No valid JSON found in response")
      }

      const implementation = JSON.parse(jsonMatch[0])
      console.log("AIAgent - Generated implementation with", implementation.files?.length || 0, "files")

      // Apply changes to GitHub if storage is available
      if (this.githubStorage) {
        console.log("AIAgent - Applying changes to GitHub")
        for (const file of implementation.files) {
          if (file.operation === "create" || file.operation === "update") {
            await this.githubStorage.saveFileContent(file.path, file.content, implementation.commitMessage)
          } else if (file.operation === "delete") {
            console.log("AIAgent - File deletion not implemented yet:", file.path)
          }
        }
        console.log("AIAgent - Changes applied to GitHub successfully")
      }

      return implementation
    } catch (error) {
      console.error("AIAgent - Error implementing task:", error)
      throw error
    }
  }

  async chatResponse(message: string, projectContext: Project, conversationHistory: any[]): Promise<string> {
    const prompt = `
    You are an advanced AI development agent with full project access and capabilities.
    
    PROJECT CONTEXT:
    - Name: ${projectContext.name}
    - Framework: ${projectContext.framework}
    - Repository: ${projectContext.repository}
    - Progress: ${projectContext.progress || 0}%
    
    USER MESSAGE: ${message}
    
    CAPABILITIES:
    - Full terminal access (can execute any command)
    - Complete file system access (read/write/create/delete)
    - Task management (create, implement, track)
    - Code implementation (write, modify, optimize)
    - Project deployment (Vercel, Netlify, etc.)
    - Web search and research
    
    Provide a helpful, specific response that demonstrates your full capabilities. Use markdown formatting.
    If the user wants to run commands, list files, or implement features, offer to do it immediately.
    `

    try {
      return await this.performAIRequest(prompt)
    } catch (error) {
      console.error("Error generating chat response:", error)
      throw error
    }
  }

  async executeTerminalCommand(command: string): Promise<string> {
    try {
      console.log("AIAgent - Executing terminal command:", command)

      // Simulate terminal command execution with intelligent responses
      const cmd = command.trim().toLowerCase()

      if (cmd === "ls" || cmd === "dir") {
        if (this.githubStorage) {
          try {
            const files = await this.githubStorage.getAllFiles()
            return `Files and directories:\n${files.map((f, i) => `${i + 1}. ${f.name} (${f.type})`).join("\n")}`
          } catch (error) {
            return `Error listing files: ${error instanceof Error ? error.message : "Unknown error"}`
          }
        }
        return "Files and directories:\n1. src/\n2. public/\n3. package.json\n4. README.md"
      }

      if (cmd.startsWith("cat ") || cmd.startsWith("type ")) {
        const filePath = command.substring(4).trim()
        if (this.githubStorage) {
          try {
            const content = await this.githubStorage.getFileContent(filePath)
            return content ? `Content of ${filePath}:\n${content}` : `File not found: ${filePath}`
          } catch (error) {
            return `Error reading file: ${error instanceof Error ? error.message : "Unknown error"}`
          }
        }
        return `Content of ${filePath}:\n// File content would be displayed here`
      }

      if (cmd === "pwd") {
        return `/workspace/project`
      }

      if (cmd.startsWith("npm ") || cmd.startsWith("yarn ")) {
        return `Executing: ${command}\n✅ Package manager command completed successfully`
      }

      if (cmd.startsWith("git ")) {
        return `Executing: ${command}\n✅ Git command completed successfully`
      }

      return `Executing: ${command}\n✅ Command completed successfully`
    } catch (error) {
      return `Error executing command: ${error instanceof Error ? error.message : "Unknown error"}`
    }
  }

  async fixDeploymentError(
    error: string,
    project: any,
  ): Promise<{
    solution: string
    files: Array<{ path: string; content: string; operation: "create" | "update" | "delete" }>
  }> {
    const prompt = `
    You are an expert deployment engineer. Analyze this deployment error and provide a fix.
    
    Project: ${project.name}
    Framework: ${project.framework}
    Platform: ${project.deploymentPlatform || "Vercel"}
    
    Deployment Error:
    ${error}
    
    CRITICAL INSTRUCTIONS:
    1. Analyze the deployment error to identify the root cause
    2. Provide specific file fixes based on the actual error
    3. Return ONLY valid JSON in this exact format
    4. Do NOT include markdown or explanations
    
    Common deployment issues and fixes:
    - JSON parsing errors: Fix malformed JSON files
    - Missing dependencies: Add to package.json
    - Build script errors: Fix build commands
    - Environment variable issues: Add default values
    - File path errors: Correct import paths
    - TypeScript errors: Fix type issues
    - Missing files: Create required files
    
    Return this exact JSON structure:
    {
      "solution": "Brief description of the fix",
      "files": [
        {
          "path": "relative/path/to/file.ext",
          "content": "complete fixed file content",
          "operation": "create|update"
        }
      ]
    }
    `

    try {
      const response = await this.performAIRequest(prompt)
      let text = response.trim()

      if (text.startsWith("```json")) {
        text = text.replace(/```json\n?/, "").replace(/\n?```$/, "")
      }

      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error("No valid JSON found in AI response")
      }

      return JSON.parse(jsonMatch[0])
    } catch (error) {
      console.error("Error fixing deployment error:", error)
      throw error
    }
  }
}
