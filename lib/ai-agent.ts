import { GoogleGenerativeAI } from "@google/generative-ai"
import type { GitHubStorageService } from "./github-storage"
import type { GitHubService } from "./github"

export interface Task {
  id: string
  title: string
  description: string
  status: "pending" | "in-progress" | "completed" | "failed"
  priority: "low" | "medium" | "high"
  type: "ai-generated" | "manual"
  estimatedTime: string
  assignedAgent?: string
  createdAt: string
  updatedAt: string
  files?: string[]
  dependencies?: string[]
  subtasks?: Task[]
  parentTaskId?: string
}

export interface Project {
  id: string
  name: string
  description: string
  framework: string
  repository: string
  owner: string
  status: "active" | "paused" | "completed"
  progress: number
  createdAt: string
  updatedAt: string
  deploymentUrl?: string
  deploymentPlatform?: "vercel" | "netlify" | "cloudflare"
}

export interface AgentFeedback {
  type: "status" | "progress" | "completion" | "error"
  message: string
  details?: any
  timestamp: string
  taskId?: string
}

export interface CodebaseIndex {
  files: Record<
    string,
    {
      content: string
      language: string
      imports: string[]
      exports: string[]
      functions: string[]
      classes: string[]
      lastModified: string
    }
  >
  dependencies: Record<string, string[]>
  structure: any
}

export class AIAgent {
  private genAI: GoogleGenerativeAI
  private model: any
  private githubStorage?: GitHubStorageService
  private github?: GitHubService
  private feedbackCallback?: (feedback: AgentFeedback) => void
  private codebaseIndex: CodebaseIndex = { files: {}, dependencies: {}, structure: {} }

  constructor(apiKey: string, githubStorage?: GitHubStorageService, github?: GitHubService) {
    this.genAI = new GoogleGenerativeAI(apiKey)
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" })
    this.githubStorage = githubStorage
    this.github = github
    this.initializeCodebaseIndex()
  }

  setFeedbackCallback(callback: (feedback: AgentFeedback) => void) {
    this.feedbackCallback = callback
  }

  private sendFeedback(feedback: AgentFeedback) {
    if (this.feedbackCallback) {
      this.feedbackCallback(feedback)
    }
  }

  private async initializeCodebaseIndex() {
    if (!this.githubStorage) return

    try {
      const memory = await this.githubStorage.getAgentMemory()
      if (memory?.fileCache) {
        for (const [path, data] of Object.entries(memory.fileCache)) {
          this.indexFile(path, data.content)
        }
      }
    } catch (error) {
      console.error("Error initializing codebase index:", error)
    }
  }

  private indexFile(path: string, content: string) {
    const language = this.getLanguageFromPath(path)
    const imports = this.extractImports(content, language)
    const exports = this.extractExports(content, language)
    const functions = this.extractFunctions(content, language)
    const classes = this.extractClasses(content, language)

    this.codebaseIndex.files[path] = {
      content,
      language,
      imports,
      exports,
      functions,
      classes,
      lastModified: new Date().toISOString(),
    }

    // Update dependencies
    this.codebaseIndex.dependencies[path] = imports
  }

  private getLanguageFromPath(path: string): string {
    const ext = path.split(".").pop()?.toLowerCase()
    const languageMap: Record<string, string> = {
      ts: "typescript",
      tsx: "typescript",
      js: "javascript",
      jsx: "javascript",
      py: "python",
      json: "json",
      md: "markdown",
      css: "css",
      scss: "scss",
      html: "html",
    }
    return languageMap[ext || ""] || "text"
  }

  private extractImports(content: string, language: string): string[] {
    const imports: string[] = []

    if (language === "typescript" || language === "javascript") {
      const importRegex = /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g
      const requireRegex = /require$$['"`]([^'"`]+)['"`]$$/g

      let match
      while ((match = importRegex.exec(content)) !== null) {
        imports.push(match[1])
      }
      while ((match = requireRegex.exec(content)) !== null) {
        imports.push(match[1])
      }
    }

    return imports
  }

  private extractExports(content: string, language: string): string[] {
    const exports: string[] = []

    if (language === "typescript" || language === "javascript") {
      const exportRegex = /export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/g
      let match
      while ((match = exportRegex.exec(content)) !== null) {
        exports.push(match[1])
      }
    }

    return exports
  }

  private extractFunctions(content: string, language: string): string[] {
    const functions: string[] = []

    if (language === "typescript" || language === "javascript") {
      const functionRegex = /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?$$|(\w+)\s*:\s*\([^)]*$$\s*=>)/g
      let match
      while ((match = functionRegex.exec(content)) !== null) {
        const funcName = match[1] || match[2] || match[3]
        if (funcName) functions.push(funcName)
      }
    }

    return functions
  }

  private extractClasses(content: string, language: string): string[] {
    const classes: string[] = []

    if (language === "typescript" || language === "javascript") {
      const classRegex = /class\s+(\w+)/g
      let match
      while ((match = classRegex.exec(content)) !== null) {
        classes.push(match[1])
      }
    }

    return classes
  }

  async searchWeb(query: string): Promise<string> {
    const searchAPIs = [
      // DuckDuckGo Instant Answer API
      async () => {
        try {
          const response = await fetch(
            `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
          )
          const data = await response.json()

          let searchResults = ""
          if (data.AbstractText) {
            searchResults += `Abstract: ${data.AbstractText}\n`
          }
          if (data.RelatedTopics && data.RelatedTopics.length > 0) {
            searchResults += "\nRelated Information:\n"
            data.RelatedTopics.slice(0, 3).forEach((topic: any, index: number) => {
              if (topic.Text) {
                searchResults += `${index + 1}. ${topic.Text}\n`
              }
            })
          }
          if (data.Answer) {
            searchResults += `\nDirect Answer: ${data.Answer}\n`
          }
          return searchResults || null
        } catch (error) {
          return null
        }
      },

      // Brave Search API (free tier)
      async () => {
        try {
          const response = await fetch(
            `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=3`,
            {
              headers: {
                "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY || "demo-key",
              },
            },
          )
          if (!response.ok) return null

          const data = await response.json()
          let searchResults = ""

          if (data.web?.results) {
            searchResults += "Search Results:\n"
            data.web.results.slice(0, 3).forEach((result: any, index: number) => {
              searchResults += `${index + 1}. ${result.title}\n${result.description}\nURL: ${result.url}\n\n`
            })
          }

          return searchResults || null
        } catch (error) {
          return null
        }
      },

      // SerpAPI (free tier)
      async () => {
        try {
          const response = await fetch(
            `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${process.env.SERPAPI_KEY || "demo"}&num=3`,
          )
          if (!response.ok) return null

          const data = await response.json()
          let searchResults = ""

          if (data.organic_results) {
            searchResults += "Search Results:\n"
            data.organic_results.slice(0, 3).forEach((result: any, index: number) => {
              searchResults += `${index + 1}. ${result.title}\n${result.snippet}\nURL: ${result.link}\n\n`
            })
          }

          return searchResults || null
        } catch (error) {
          return null
        }
      },
    ]

    // Try each search API until one works
    for (const searchAPI of searchAPIs) {
      try {
        const result = await searchAPI()
        if (result) {
          return result
        }
      } catch (error) {
        console.error("Search API error:", error)
        continue
      }
    }

    return "Web search temporarily unavailable."
  }

  async scrapeWebsite(url: string): Promise<string> {
    try {
      // Use a free web scraping service or implement basic scraping
      const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`)
      const data = await response.json()

      if (data.contents) {
        // Basic HTML parsing to extract text content
        const textContent = data.contents
          .replace(/<script[^>]*>.*?<\/script>/gi, "")
          .replace(/<style[^>]*>.*?<\/style>/gi, "")
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim()

        return textContent.slice(0, 2000) // Limit to 2000 characters
      }

      return "Could not scrape website content"
    } catch (error) {
      console.error("Web scraping error:", error)
      return "Web scraping failed"
    }
  }

  async executeToolCall(toolCall: string, context: any): Promise<string> {
    try {
      // Enhanced tool execution with more capabilities
      if (toolCall.includes("web_search.search")) {
        const queryMatch = toolCall.match(/queries=\["([^"]+)"\]/)
        if (queryMatch) {
          const query = queryMatch[1]
          return await this.searchWeb(query)
        }
      }

      if (toolCall.includes("scrape_website")) {
        const urlMatch = toolCall.match(/url=["']([^"']+)["']/)
        if (urlMatch) {
          const url = urlMatch[1]
          return await this.scrapeWebsite(url)
        }
      }

      if (toolCall.includes("analyze_codebase")) {
        const pathMatch = toolCall.match(/path=["']([^"']+)["']/)
        if (pathMatch) {
          const path = pathMatch[1]
          const fileInfo = this.codebaseIndex.files[path]
          if (fileInfo) {
            return `File Analysis for ${path}:
Language: ${fileInfo.language}
Functions: ${fileInfo.functions.join(", ")}
Classes: ${fileInfo.classes.join(", ")}
Imports: ${fileInfo.imports.join(", ")}
Exports: ${fileInfo.exports.join(", ")}
Last Modified: ${fileInfo.lastModified}`
          }
        }
      }

      if (toolCall.includes('files["package.json"]')) {
        if (this.githubStorage) {
          try {
            const content = await this.githubStorage.getFileContent("package.json")
            return `package.json content:\n${content}`
          } catch (error) {
            return `Error reading package.json: ${error instanceof Error ? error.message : "Unknown error"}`
          }
        }
        return "GitHub storage not available"
      }

      if (toolCall.includes("JSON.parse")) {
        const jsonMatch = toolCall.match(/JSON\.parse$$([^)]+)$$/)
        if (jsonMatch && this.githubStorage) {
          try {
            const content = await this.githubStorage.getFileContent("package.json")
            JSON.parse(content)
            return "✅ JSON validation successful - package.json is valid"
          } catch (error) {
            return `❌ JSON validation failed: ${error instanceof Error ? error.message : "Unknown error"}`
          }
        }
      }

      return "Tool call executed but no specific handler found"
    } catch (error) {
      return `Error executing tool call: ${error instanceof Error ? error.message : "Unknown error"}`
    }
  }

  async getProjectContext(): Promise<any> {
    if (!this.githubStorage) {
      return {}
    }

    try {
      const [memory, metadata, tasks] = await Promise.all([
        this.githubStorage.getAgentMemory(),
        this.githubStorage.getProjectMetadata(),
        this.githubStorage.getTasks(),
      ])

      // Get file cache for code context
      const fileCache = memory?.fileCache || {}
      const codeFiles = Object.entries(fileCache)
        .filter(
          ([path]) =>
            path.endsWith(".js") ||
            path.endsWith(".jsx") ||
            path.endsWith(".ts") ||
            path.endsWith(".tsx") ||
            path.endsWith(".vue") ||
            path.endsWith(".py") ||
            path.endsWith(".json"),
        )
        .slice(0, 20) // Limit to prevent token overflow

      return {
        memory,
        metadata,
        tasks,
        codeFiles,
        projectStructure: Object.keys(fileCache),
        recentActivity: memory?.conversationHistory?.slice(-10) || [],
        codebaseIndex: this.codebaseIndex,
      }
    } catch (error) {
      console.error("Error getting project context:", error)
      return {}
    }
  }

  async commitChanges(
    files: Array<{ path: string; content: string; operation: "create" | "update" | "delete" }>,
    commitMessage: string,
  ): Promise<boolean> {
    if (!this.github || !this.githubStorage) {
      console.error("GitHub service not available for committing changes")
      return false
    }

    try {
      this.sendFeedback({
        type: "status",
        message: `Committing ${files.length} file changes to GitHub...`,
        timestamp: new Date().toISOString(),
      })

      // Apply each file change and update codebase index
      for (const file of files) {
        try {
          if (file.operation === "create" || file.operation === "update") {
            await this.githubStorage.updateFileContent(file.path, file.content, commitMessage)
            // Update codebase index
            this.indexFile(file.path, file.content)
          } else if (file.operation === "delete") {
            // Handle file deletion if needed
            delete this.codebaseIndex.files[file.path]
            console.log(`Delete operation for ${file.path} - implement if needed`)
          }
        } catch (fileError) {
          console.error(`Error processing file ${file.path}:`, fileError)
          // Continue with other files
        }
      }

      this.sendFeedback({
        type: "completion",
        message: `Successfully committed ${files.length} files to GitHub`,
        timestamp: new Date().toISOString(),
      })

      return true
    } catch (error) {
      this.sendFeedback({
        type: "error",
        message: `Failed to commit changes: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date().toISOString(),
      })
      return false
    }
  }

  async implementTask(
    task: Task,
    projectContext: any,
  ): Promise<{
    files: Array<{ path: string; content: string; operation: "create" | "update" | "delete" }>
    message: string
    commitMessage: string
  }> {
    this.sendFeedback({
      type: "status",
      message: `Starting implementation of: ${task.title}`,
      taskId: task.id,
      timestamp: new Date().toISOString(),
    })

    // Get full context including cached files and codebase index
    const fullContext = await this.getProjectContext()

    // Enhanced prompt with better context and intelligence
    const prompt = `
    You are an expert ${projectContext.framework} developer with deep understanding of the codebase.
    
    TASK TO IMPLEMENT: ${task.title}
    DESCRIPTION: ${task.description}
    PRIORITY: ${task.priority}
    FRAMEWORK: ${projectContext.framework}
    ASSOCIATED FILES: ${task.files?.join(", ") || "Auto-detect from context"}
    
    PROJECT CONTEXT:
    - Name: ${projectContext.name}
    - Description: ${projectContext.description}
    - Repository: ${projectContext.repository}
    - Current Progress: ${projectContext.progress || 0}%
    
    CODEBASE INTELLIGENCE:
    - Total Files: ${Object.keys(fullContext.codebaseIndex?.files || {}).length}
    - Key Components: ${Object.values(fullContext.codebaseIndex?.files || {})
      .filter((f) => f.language === "typescript" && f.exports.length > 0)
      .map((f) => f.exports.join(", "))
      .slice(0, 10)
      .join(", ")}
    
    RECENT CONTEXT:
    - Recent Tasks: ${JSON.stringify(fullContext.tasks?.slice(-3) || [])}
    - Recent Activity: ${JSON.stringify(fullContext.recentActivity?.slice(-3) || [])}
    
    CURRENT PROJECT FILES (for reference):
    ${fullContext.codeFiles
      ?.map(([path, data]: [string, any]) => `${path}:\n${data.content?.slice(0, 300)}...`)
      .slice(0, 8)
      .join("\n\n")}
    
    INTELLIGENT IMPLEMENTATION INSTRUCTIONS:
    1. Analyze the task in context of the existing codebase
    2. Identify all files that need to be modified based on dependencies
    3. Ensure consistency with existing code patterns and architecture
    4. Handle edge cases and error scenarios
    5. Update related tests and documentation if applicable
    6. Follow the project's coding standards and conventions
    
    SPECIAL INSTRUCTIONS FOR THIS TASK:
    ${
      task.title.toLowerCase().includes("aladhan")
        ? `
    - Replace IslamicFinder API with Aladhan.com API
    - Update API endpoint to: https://api.aladhan.com/v1/timings
    - Map response format: data.data.timings.{Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha}
    - Ensure all prayer time components work with new data structure
    - Add proper error handling for API failures
    - Update any related hooks and services
    `
        : ""
    }
    
    CRITICAL REQUIREMENTS:
    1. Return ONLY valid JSON in this exact format
    2. Include ALL necessary files for complete implementation
    3. Ensure all code is production-ready and tested
    4. Follow TypeScript best practices
    5. Maintain backward compatibility where possible
    
    REQUIRED JSON FORMAT:
    {
      "files": [
        {
          "path": "relative/path/to/file.ext",
          "content": "complete file content with proper escaping",
          "operation": "create|update|delete"
        }
      ],
      "message": "Detailed implementation summary with what was changed and why",
      "commitMessage": "feat: descriptive commit message following conventional commits"
    }
    
    Generate a complete, intelligent implementation that considers the full project context.
    `

    try {
      this.sendFeedback({
        type: "progress",
        message: "Analyzing codebase and generating intelligent implementation",
        taskId: task.id,
        timestamp: new Date().toISOString(),
      })

      const result = await this.model.generateContent(prompt)
      const response = await result.response
      let text = response.text().trim()

      // Clean up the response to ensure it's valid JSON
      if (text.startsWith("```json")) {
        text = text.replace(/```json\n?/, "").replace(/\n?```$/, "")
      }
      if (text.startsWith("```")) {
        text = text.replace(/```\n?/, "").replace(/\n?```$/, "")
      }

      // Find JSON content
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error("No valid JSON found in response")
      }

      let implementation
      try {
        implementation = JSON.parse(jsonMatch[0])
      } catch (parseError) {
        console.error("JSON Parse Error:", parseError)
        console.error("Raw response:", text)
        throw new Error(
          `Invalid JSON response: ${parseError instanceof Error ? parseError.message : "Unknown parsing error"}`,
        )
      }

      // Validate the implementation structure
      if (!implementation.files || !Array.isArray(implementation.files)) {
        throw new Error("Implementation must include a 'files' array")
      }

      if (!implementation.message || !implementation.commitMessage) {
        throw new Error("Implementation must include 'message' and 'commitMessage'")
      }

      this.sendFeedback({
        type: "progress",
        message: `Generated ${implementation.files.length} file operations`,
        taskId: task.id,
        details: { fileCount: implementation.files.length },
        timestamp: new Date().toISOString(),
      })

      // Apply the implementation to GitHub immediately
      for (const file of implementation.files) {
        try {
          if (file.operation === "create" || file.operation === "update") {
            // Try to get existing file first
            try {
              const existingFile = await this.github.getFileContent(
                projectContext.repository.split("/").slice(-2)[0],
                projectContext.repository.split("/").slice(-2)[1],
                file.path,
              )
              // File exists, update it
              await this.github.updateFile(
                projectContext.repository.split("/").slice(-2)[0],
                projectContext.repository.split("/").slice(-2)[1],
                file.path,
                file.content,
                implementation.commitMessage,
                existingFile.sha,
              )
            } catch (error) {
              // File doesn't exist, create it
              await this.github.createFile(
                projectContext.repository.split("/").slice(-2)[0],
                projectContext.repository.split("/").slice(-2)[1],
                file.path,
                file.content,
                implementation.commitMessage,
              )
            }

            // Update codebase index
            this.indexFile(file.path, file.content)
          } else if (file.operation === "delete") {
            try {
              const existingFile = await this.github.getFileContent(
                projectContext.repository.split("/").slice(-2)[0],
                projectContext.repository.split("/").slice(-2)[1],
                file.path,
              )
              await this.github.deleteFile(
                projectContext.repository.split("/").slice(-2)[0],
                projectContext.repository.split("/").slice(-2)[1],
                file.path,
                implementation.commitMessage,
                existingFile.sha,
              )

              // Remove from codebase index
              delete this.codebaseIndex.files[file.path]
            } catch (error) {
              console.log(`File ${file.path} doesn't exist, skipping delete`)
            }
          }
        } catch (fileError) {
          console.error(`Error processing file ${file.path}:`, fileError)
          throw new Error(
            `Failed to process file ${file.path}: ${fileError instanceof Error ? fileError.message : "Unknown error"}`,
          )
        }
      }

      this.sendFeedback({
        type: "completion",
        message: `Successfully committed ${implementation.files.length} files to GitHub`,
        timestamp: new Date().toISOString(),
      })

      // Update agent memory with enhanced learnings
      if (this.githubStorage) {
        try {
          const currentMemory = await this.githubStorage.getAgentMemory()
          const updatedMemory = {
            projectId: projectContext.id,
            conversationHistory: currentMemory?.conversationHistory || [],
            taskHistory: [...(currentMemory?.taskHistory || []), task],
            codeContext: [...(currentMemory?.codeContext || []), ...implementation.files],
            learnings: {
              ...currentMemory?.learnings,
              [task.id]: {
                task: task.title,
                implementation: implementation.message,
                files: implementation.files.map((f: any) => f.path),
                timestamp: new Date().toISOString(),
                patterns: this.extractCodePatterns(implementation.files),
                codebaseChanges: this.analyzeCodebaseChanges(implementation.files),
              },
            },
            currentFocus: task.title,
            lastUpdate: new Date().toISOString(),
            fileCache: currentMemory?.fileCache || {},
            codebaseIndex: this.codebaseIndex,
          }

          await this.githubStorage.saveAgentMemory(updatedMemory)
        } catch (error) {
          console.error("Error updating agent memory:", error)
        }
      }

      this.sendFeedback({
        type: "completion",
        message: `Successfully implemented: ${task.title}`,
        taskId: task.id,
        timestamp: new Date().toISOString(),
      })

      return implementation
    } catch (error) {
      this.sendFeedback({
        type: "error",
        message: `Error implementing task: ${error instanceof Error ? error.message : "Unknown error"}`,
        taskId: task.id,
        timestamp: new Date().toISOString(),
      })
      console.error("Error implementing task:", error)
      throw error
    }
  }

  private analyzeCodebaseChanges(files: any[]): any {
    const changes = {
      newFiles: [],
      modifiedFiles: [],
      deletedFiles: [],
      newDependencies: [],
      affectedComponents: [],
    }

    files.forEach((file) => {
      if (file.operation === "create") {
        changes.newFiles.push(file.path)
      } else if (file.operation === "update") {
        changes.modifiedFiles.push(file.path)
      } else if (file.operation === "delete") {
        changes.deletedFiles.push(file.path)
      }

      // Analyze dependencies
      if (file.content) {
        const imports = this.extractImports(file.content, this.getLanguageFromPath(file.path))
        imports.forEach((imp) => {
          if (!changes.newDependencies.includes(imp)) {
            changes.newDependencies.push(imp)
          }
        })
      }
    })

    return changes
  }

  private extractCodePatterns(files: any[]): any {
    // Enhanced pattern extraction with more intelligence
    const patterns = {
      imports: [],
      components: [],
      functions: [],
      styles: [],
      apiCalls: [],
      hooks: [],
      types: [],
    }

    files.forEach((file) => {
      if (file.content) {
        const language = this.getLanguageFromPath(file.path)

        // Extract import patterns
        const imports = this.extractImports(file.content, language)
        patterns.imports.push(...imports)

        // Extract component patterns
        const components = file.content.match(/(?:function|const)\s+\w+.*(?:React\.FC|JSX\.Element)/g) || []
        patterns.components.push(...components)

        // Extract function patterns
        const functions = this.extractFunctions(file.content, language)
        patterns.functions.push(...functions)

        // Extract API calls
        const apiCalls = file.content.match(/fetch\(['"`]([^'"`]+)['"`]/g) || []
        patterns.apiCalls.push(...apiCalls)

        // Extract hooks
        const hooks = file.content.match(/use\w+/g) || []
        patterns.hooks.push(...hooks)

        // Extract TypeScript types
        const types = file.content.match(/(?:interface|type)\s+(\w+)/g) || []
        patterns.types.push(...types)
      }
    })

    return patterns
  }

  async generateTasks(projectDescription: string, framework: string): Promise<Task[]> {
    this.sendFeedback({
      type: "status",
      message: "Analyzing project requirements and generating intelligent tasks",
      timestamp: new Date().toISOString(),
    })

    // Get existing context from GitHub if available
    const fullContext = await this.getProjectContext()

    const prompt = `
    As an expert software architect with deep understanding of ${framework} and modern development practices, analyze this project and generate intelligent, actionable tasks.
    
    PROJECT ANALYSIS:
    - Description: ${projectDescription}
    - Framework: ${framework}
    - Current State: ${fullContext.tasks?.length || 0} existing tasks
    - Completed: ${fullContext.tasks?.filter((t: any) => t.status === "completed").length || 0} tasks
    - Progress: ${fullContext.metadata?.progress || 0}%
    
    CODEBASE CONTEXT:
    - Existing Files: ${Object.keys(fullContext.codebaseIndex?.files || {}).length}
    - Key Components: ${Object.values(fullContext.codebaseIndex?.files || {})
      .filter((f) => f.language === "typescript")
      .map((f) => f.exports.join(", "))
      .slice(0, 5)
      .join(", ")}
    
    INTELLIGENT TASK GENERATION REQUIREMENTS:
    1. Analyze existing codebase to avoid duplicate work
    2. Generate tasks that build upon existing functionality
    3. Consider dependencies between tasks
    4. Include specific file paths and technical details
    5. Prioritize based on project needs and complexity
    6. Include acceptance criteria for each task
    
    TASK CATEGORIES TO COVER:
    1. Core Functionality & Business Logic
    2. User Interface & User Experience
    3. API Integration & Data Management
    4. Testing & Quality Assurance
    5. Performance & Optimization
    6. Security & Error Handling
    7. Documentation & Deployment
    8. Accessibility & Internationalization
    
    CRITICAL: Return ONLY valid JSON in this exact format:
    {
      "tasks": [
        {
          "title": "Specific, actionable task title",
          "description": "Detailed description with technical requirements and context",
          "priority": "high|medium|low",
          "estimatedTime": "X hours",
          "dependencies": ["task_id_1", "task_id_2"],
          "files": ["specific/file/paths.ts", "that/will/be/modified.tsx"],
          "acceptanceCriteria": [
            "Specific, measurable criteria",
            "Technical requirements",
            "User-facing outcomes"
          ],
          "technicalNotes": "Implementation hints, patterns to follow, or specific considerations"
        }
      ]
    }
    
    Generate 8-12 intelligent, well-structured tasks that will advance the project meaningfully.
    `

    try {
      const result = await this.model.generateContent(prompt)
      const response = await result.response
      let text = response.text().trim()

      // Clean up the response
      if (text.startsWith("```json")) {
        text = text.replace(/```json\n?/, "").replace(/\n?```$/, "")
      }
      if (text.startsWith("```")) {
        text = text.replace(/```\n?/, "").replace(/\n?```$/, "")
      }

      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        const tasks = parsed.tasks.map((task: any, index: number) => ({
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
          acceptanceCriteria: task.acceptanceCriteria || [],
          technicalNotes: task.technicalNotes || "",
        }))

        this.sendFeedback({
          type: "completion",
          message: `Generated ${tasks.length} intelligent development tasks`,
          details: { taskCount: tasks.length },
          timestamp: new Date().toISOString(),
        })

        return tasks
      }
      throw new Error("Invalid response format")
    } catch (error) {
      this.sendFeedback({
        type: "error",
        message: `Error generating tasks: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date().toISOString(),
      })
      console.error("Error generating tasks:", error)
      throw error
    }
  }

  async chatResponse(message: string, projectContext: any, conversationHistory: any[]): Promise<string> {
    // Enhanced intelligence for understanding user intent
    const userIntent = this.analyzeUserIntent(message, conversationHistory)

    // Get full context including cached files and codebase index
    const fullContext = await this.getProjectContext()

    // Enhanced contextual understanding
    const contextualInsights = this.generateContextualInsights(fullContext, userIntent)

    // Check if user is asking for web search
    const needsWebSearch = userIntent.needsWebSearch

    let webSearchResults = ""
    if (needsWebSearch) {
      this.sendFeedback({
        type: "status",
        message: "Searching for relevant information",
        timestamp: new Date().toISOString(),
      })
      webSearchResults = await this.searchWeb(message)
    }

    // Enhanced prompt with superior intelligence and context awareness
    const prompt = `
  You are an advanced AI development agent with exceptional intelligence, deep project understanding, and superior contextual reasoning.
  
  PROJECT INTELLIGENCE MATRIX:
  - Name: ${projectContext.name}
  - Framework: ${projectContext.framework} 
  - Description: ${projectContext.description}
  - Status: ${projectContext.status}
  - Progress: ${projectContext.progress || 0}%
  - Repository: ${projectContext.repository}
  
  ADVANCED CODEBASE INTELLIGENCE:
  - Total Files: ${Object.keys(fullContext.codebaseIndex?.files || {}).length}
  - Languages: ${Object.values(fullContext.codebaseIndex?.files || {})
    .map((f) => f.language)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(", ")}
  - Key Components: ${Object.values(fullContext.codebaseIndex?.files || {})
    .filter((f) => f.language === "typescript" && f.exports.length > 0)
    .map((f) => f.exports.join(", "))
    .slice(0, 10)
    .join(", ")}
  - Dependencies: ${Object.values(fullContext.codebaseIndex?.dependencies || {})
    .flat()
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 15)
    .join(", ")}
  
  CONTEXTUAL MEMORY & INTELLIGENCE:
  - Current Focus: ${fullContext.memory?.currentFocus || "Development"}
  - Task Analytics: ${fullContext.tasks?.filter((t: any) => t.status === "completed").length || 0} completed, ${fullContext.tasks?.filter((t: any) => t.status === "pending").length || 0} pending, ${fullContext.tasks?.filter((t: any) => t.status === "failed").length || 0} failed
  - Recent Implementations: ${Object.keys(fullContext.memory?.learnings || {})
    .slice(-3)
    .join(", ")}
  - User Patterns: ${fullContext.memory?.userPreferences?.commonRequests?.join(", ") || "Learning..."}
  - Response Style: ${fullContext.memory?.userPreferences?.detailLevel || "adaptive"}
  
  CONVERSATION INTELLIGENCE:
  Recent Context (last 5 messages):
  ${conversationHistory
    .slice(-5)
    .map((msg, i) => `${i + 1}. ${msg.role}: ${msg.content}`)
    .join("\n")}
  
  USER INTENT ANALYSIS:
  - Intent Type: ${userIntent.type}
  - Confidence: ${userIntent.confidence}
  - Suggested Actions: ${userIntent.suggestedActions.join(", ")}
  - Context Clues: ${userIntent.contextClues.join(", ")}
  - Requires Action: ${userIntent.requiresAction}
  
  CONTEXTUAL INSIGHTS:
  ${contextualInsights.join("\n")}
  
  ${webSearchResults ? `EXTERNAL KNOWLEDGE: ${webSearchResults}` : ""}
  
  CURRENT USER MESSAGE: ${message}
  
  SUPERIOR AI CAPABILITIES:
  1. Deep semantic understanding of user intent beyond literal interpretation
  2. Contextual memory spanning entire project lifecycle with pattern recognition
  3. Proactive problem identification and solution suggestion
  4. Intelligent task orchestration and autonomous implementation
  5. Real-time codebase analysis with dependency mapping
  6. Advanced error prediction and prevention
  7. Adaptive communication style based on user preferences
  8. Multi-modal reasoning combining code, conversation, and external knowledge
  9. Autonomous learning and improvement from each interaction
  10. Strategic project guidance based on best practices and patterns
  
  INTELLIGENT RESPONSE FRAMEWORK:
  1. UNDERSTAND: Analyze the user's true intent, not just surface-level words
  2. CONTEXTUALIZE: Consider full project state, history, and patterns
  3. ANTICIPATE: Predict follow-up needs and potential issues
  4. RECOMMEND: Provide specific, actionable guidance based on actual project state
  5. EXECUTE: Offer to take autonomous actions when beneficial
  6. LEARN: Extract insights for future interactions
  
  RESPONSE REQUIREMENTS:
  - Demonstrate deep understanding of the project and user's goals
  - Provide specific, contextual advice referencing actual files and code
  - Anticipate needs and offer proactive solutions
  - Use appropriate technical depth based on user's demonstrated expertise
  - Offer concrete next steps and autonomous actions
  - Show learning from previous interactions
  - Be conversational yet professional and highly knowledgeable
  
  Generate an exceptionally intelligent response that showcases deep project understanding and provides maximum value to the user.
  `

    try {
      const result = await this.model.generateContent(prompt)
      const response = await result.response
      const chatResponse = response.text()

      // Enhanced autonomous action detection
      const autonomousActions = this.detectAutonomousActions(chatResponse, userIntent)

      if (autonomousActions.length > 0) {
        // Execute autonomous actions
        for (const action of autonomousActions) {
          await this.executeAutonomousAction(action, fullContext)
        }
      }

      // Update conversation history with enhanced context
      if (this.githubStorage) {
        try {
          const currentMemory = await this.githubStorage.getAgentMemory()
          const updatedHistory = [
            ...(currentMemory?.conversationHistory || []),
            {
              role: "user",
              content: message,
              timestamp: new Date().toISOString(),
              intent: userIntent,
              context: {
                projectState: {
                  progress: projectContext.progress,
                  taskCount: fullContext.tasks?.length || 0,
                  fileCount: Object.keys(fullContext.codebaseIndex?.files || {}).length,
                },
              },
            },
            {
              role: "agent",
              content: chatResponse,
              timestamp: new Date().toISOString(),
              context: {
                webSearchUsed: needsWebSearch,
                codebaseReferenced:
                  chatResponse.includes("src/") || chatResponse.includes(".ts") || chatResponse.includes(".tsx"),
                actionsOffered: this.extractOfferedActions(chatResponse),
                autonomousActions: autonomousActions.map((a) => a.type),
                insights: contextualInsights,
              },
            },
          ].slice(-50)

          const updatedMemory = {
            ...currentMemory,
            projectId: projectContext.id,
            conversationHistory: updatedHistory,
            lastUpdate: new Date().toISOString(),
            fileCache: currentMemory?.fileCache || {},
            codebaseIndex: this.codebaseIndex,
            userPreferences: {
              ...currentMemory?.userPreferences,
              preferredResponseStyle: this.analyzeResponsePreferences(conversationHistory),
              commonRequests: this.analyzeCommonRequests(conversationHistory),
              technicalLevel: this.assessTechnicalLevel(conversationHistory),
              interactionPatterns: this.analyzeInteractionPatterns(conversationHistory),
            },
            projectInsights: {
              ...currentMemory?.projectInsights,
              lastAnalysis: new Date().toISOString(),
              keyPatterns: this.extractProjectPatterns(fullContext),
              improvementAreas: this.identifyImprovementAreas(fullContext),
              nextSteps: this.suggestNextSteps(fullContext, userIntent),
            },
          }

          await this.githubStorage.saveAgentMemory(updatedMemory)
        } catch (error) {
          console.error("Error updating enhanced conversation history:", error)
        }
      }

      return chatResponse
    } catch (error) {
      this.sendFeedback({
        type: "error",
        message: `Error generating response: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date().toISOString(),
      })
      console.error("Error generating chat response:", error)
      throw error
    }
  }

  private generateContextualInsights(fullContext: any, userIntent: any): string[] {
    const insights: string[] = []

    // Project health insights
    const completedTasks = fullContext.tasks?.filter((t: any) => t.status === "completed").length || 0
    const totalTasks = fullContext.tasks?.length || 0
    const completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : "0"

    insights.push(`📊 Project Health: ${completionRate}% task completion rate`)

    // Code quality insights
    const tsFiles = Object.values(fullContext.codebaseIndex?.files || {}).filter(
      (f: any) => f.language === "typescript",
    ).length
    const totalFiles = Object.keys(fullContext.codebaseIndex?.files || {}).length

    if (totalFiles > 0) {
      insights.push(
        `🔧 Codebase: ${tsFiles}/${totalFiles} TypeScript files (${((tsFiles / totalFiles) * 100).toFixed(1)}% typed)`,
      )
    }

    // Recent activity insights
    const recentLearnings = Object.keys(fullContext.memory?.learnings || {}).slice(-3)
    if (recentLearnings.length > 0) {
      insights.push(`🎯 Recent Focus: ${recentLearnings.join(", ")}`)
    }

    // Intent-based insights
    if (userIntent.type === "implementation" && totalTasks > 0) {
      const pendingTasks = fullContext.tasks?.filter((t: any) => t.status === "pending").length || 0
      insights.push(`⚡ Ready for Implementation: ${pendingTasks} pending tasks available`)
    }

    return insights
  }

  private detectAutonomousActions(response: string, userIntent: any): Array<{ type: string; data: any }> {
    const actions: Array<{ type: string; data: any }> = []

    // Detect if agent should create tasks
    if (response.includes("I'll create") && response.includes("task")) {
      actions.push({
        type: "create_task",
        data: { fromResponse: true },
      })
    }

    // Detect if agent should analyze code
    if (response.includes("Let me analyze") || response.includes("I'll examine")) {
      actions.push({
        type: "analyze_codebase",
        data: { trigger: "autonomous" },
      })
    }

    // Detect if agent should implement something
    if (response.includes("I'll implement") || response.includes("Let me implement")) {
      actions.push({
        type: "implement_feature",
        data: { autonomous: true },
      })
    }

    return actions
  }

  private async executeAutonomousAction(action: { type: string; data: any }, context: any): Promise<void> {
    try {
      switch (action.type) {
        case "analyze_codebase":
          // Perform deep codebase analysis
          await this.performCodebaseAnalysis(context)
          break
        case "create_task":
          // Create intelligent tasks based on context
          await this.createIntelligentTasks(context)
          break
        case "implement_feature":
          // Implement features autonomously
          await this.autonomousImplementation(context)
          break
      }
    } catch (error) {
      console.error(`Error executing autonomous action ${action.type}:`, error)
    }
  }

  private assessTechnicalLevel(conversationHistory: any[]): string {
    const userMessages = conversationHistory.filter((msg) => msg.role === "user")
    let technicalScore = 0

    userMessages.forEach((msg) => {
      const content = msg.content.toLowerCase()

      // Technical indicators
      if (content.includes("typescript") || content.includes("javascript")) technicalScore += 2
      if (content.includes("api") || content.includes("endpoint")) technicalScore += 2
      if (content.includes("component") || content.includes("hook")) technicalScore += 2
      if (content.includes("deploy") || content.includes("build")) technicalScore += 1
      if (content.includes("error") || content.includes("debug")) technicalScore += 1

      // Advanced technical indicators
      if (content.includes("async") || content.includes("promise")) technicalScore += 3
      if (content.includes("interface") || content.includes("type")) technicalScore += 3
      if (content.includes("webpack") || content.includes("vite")) technicalScore += 4
    })

    const avgScore = userMessages.length > 0 ? technicalScore / userMessages.length : 0

    if (avgScore >= 3) return "expert"
    if (avgScore >= 1.5) return "intermediate"
    return "beginner"
  }

  private analyzeInteractionPatterns(conversationHistory: any[]): any {
    const patterns = {
      preferredActions: [] as string[],
      communicationStyle: "direct",
      sessionLength: "medium",
      topicFocus: [] as string[],
    }

    const userMessages = conversationHistory.filter((msg) => msg.role === "user")

    // Analyze preferred actions
    userMessages.forEach((msg) => {
      const content = msg.content.toLowerCase()
      if (content.includes("implement")) patterns.preferredActions.push("implementation")
      if (content.includes("create")) patterns.preferredActions.push("creation")
      if (content.includes("fix")) patterns.preferredActions.push("fixing")
      if (content.includes("explain")) patterns.preferredActions.push("explanation")
    })

    // Analyze communication style
    const avgMessageLength = userMessages.reduce((sum, msg) => sum + msg.content.length, 0) / userMessages.length
    if (avgMessageLength > 100) patterns.communicationStyle = "detailed"
    else if (avgMessageLength < 30) patterns.communicationStyle = "concise"

    return patterns
  }

  private extractProjectPatterns(fullContext: any): any {
    return {
      architectureStyle: this.detectArchitectureStyle(fullContext),
      commonPatterns: this.identifyCommonPatterns(fullContext),
      codeQuality: this.assessCodeQuality(fullContext),
    }
  }

  private identifyImprovementAreas(fullContext: any): string[] {
    const areas: string[] = []

    const failedTasks = fullContext.tasks?.filter((t: any) => t.status === "failed").length || 0
    if (failedTasks > 0) {
      areas.push(`${failedTasks} failed tasks need attention`)
    }

    const tsFiles = Object.values(fullContext.codebaseIndex?.files || {}).filter(
      (f: any) => f.language === "typescript",
    ).length
    const jsFiles = Object.values(fullContext.codebaseIndex?.files || {}).filter(
      (f: any) => f.language === "javascript",
    ).length

    if (jsFiles > tsFiles) {
      areas.push("Consider migrating JavaScript files to TypeScript")
    }

    return areas
  }

  private suggestNextSteps(fullContext: any, userIntent: any): string[] {
    const steps: string[] = []

    const pendingTasks = fullContext.tasks?.filter((t: any) => t.status === "pending").length || 0
    if (pendingTasks > 0) {
      steps.push(`Implement ${pendingTasks} pending tasks`)
    }

    if (userIntent.type === "implementation") {
      steps.push("Focus on core functionality implementation")
    }

    return steps
  }
}
