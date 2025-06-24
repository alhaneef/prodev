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

export class AIAgent {
  private genAI: GoogleGenerativeAI
  private model: any
  private githubStorage?: GitHubStorageService
  private github?: GitHubService
  private feedbackCallback?: (feedback: AgentFeedback) => void

  constructor(apiKey: string, githubStorage?: GitHubStorageService, github?: GitHubService) {
    this.genAI = new GoogleGenerativeAI(apiKey)
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" })
    this.githubStorage = githubStorage
    this.github = github
  }

  setFeedbackCallback(callback: (feedback: AgentFeedback) => void) {
    this.feedbackCallback = callback
  }

  private sendFeedback(feedback: AgentFeedback) {
    if (this.feedbackCallback) {
      this.feedbackCallback(feedback)
    }
  }

  async searchWeb(query: string): Promise<string> {
    try {
      // Using DuckDuckGo Instant Answer API (free)
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

      return searchResults || "No relevant information found."
    } catch (error) {
      console.error("Web search error:", error)
      return "Web search temporarily unavailable."
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
      }
    } catch (error) {
      console.error("Error getting project context:", error)
      return {}
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

    // Get full context including cached files
    const fullContext = await this.getProjectContext()

    const prompt = `
    You are an expert ${projectContext.framework} developer with full project context and access to all project files.
    
    Task to Implement: ${task.title}
    Description: ${task.description}
    Priority: ${task.priority}
    Framework: ${projectContext.framework}
    
    Full Project Context:
    - Name: ${projectContext.name}
    - Description: ${projectContext.description}
    - Current Progress: ${fullContext.metadata?.progress || 0}%
    - Previous Learnings: ${JSON.stringify(fullContext.memory?.learnings || {})}
    - Existing Tasks: ${fullContext.tasks?.length || 0} tasks
    - Agent Focus: ${fullContext.memory?.currentFocus || "Development"}
    
    Current Project Files:
    ${fullContext.codeFiles
      ?.map(([path, data]: [string, any]) => `${path}:\n${data.content?.slice(0, 500)}...\n`)
      .join("\n")}
    
    Project Structure:
    ${fullContext.projectStructure?.slice(0, 50).join("\n")}
    
    Recent Activity:
    ${fullContext.recentActivity
      ?.map((msg: any) => `${msg.role}: ${msg.content}`)
      .slice(0, 5)
      .join("\n")}
    
    IMPORTANT INSTRUCTIONS:
    1. You have FULL ACCESS to all project files through the context above
    2. Analyze existing files to avoid duplicates or conflicts
    3. Use DIFF-based editing when possible to save tokens
    4. Only provide full file content when creating new files
    5. For updates, specify the exact changes needed
    6. Consider DRY principles and code reusability
    7. Maintain consistency with existing code patterns
    8. Include proper error handling and validation
    9. Add comprehensive comments for complex logic
    10. NEVER create dummy or placeholder implementations - make it fully functional
    
    Generate the implementation with these operations:
    - "create": For new files (provide full content)
    - "update": For existing files (provide full content)
    - "delete": For files to be removed
    
    Return as JSON:
    {
      "files": [
        {
          "path": "relative/path/to/file.ext",
          "content": "complete file content",
          "operation": "create|update|delete"
        }
      ],
      "message": "Implementation summary with technical details",
      "commitMessage": "feat: descriptive commit message following conventional commits"
    }
    `

    try {
      this.sendFeedback({
        type: "progress",
        message: "Analyzing codebase and generating implementation",
        taskId: task.id,
        timestamp: new Date().toISOString(),
      })

      const result = await this.model.generateContent(prompt)
      const response = await result.response
      const text = response.text()

      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const implementation = JSON.parse(jsonMatch[0])

        this.sendFeedback({
          type: "progress",
          message: `Generated ${implementation.files.length} file operations`,
          taskId: task.id,
          details: { fileCount: implementation.files.length },
          timestamp: new Date().toISOString(),
        })

        // Update agent memory with new learnings
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
                },
              },
              currentFocus: task.title,
              lastUpdate: new Date().toISOString(),
              fileCache: currentMemory?.fileCache || {},
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
      }
      throw new Error("Invalid response format")
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

  private extractCodePatterns(files: any[]): any {
    // Extract common patterns from implemented files for learning
    const patterns = {
      imports: [],
      components: [],
      functions: [],
      styles: [],
    }

    files.forEach((file) => {
      if (file.content) {
        // Extract import patterns
        const imports = file.content.match(/import.*from.*['"`].*['"`]/g) || []
        patterns.imports.push(...imports)

        // Extract component patterns
        const components = file.content.match(/(?:function|const)\s+\w+.*(?:React\.FC|JSX\.Element)/g) || []
        patterns.components.push(...components)

        // Extract function patterns
        const functions = file.content.match(/(?:async\s+)?function\s+\w+/g) || []
        patterns.functions.push(...functions)
      }
    })

    return patterns
  }

  async generateTasks(projectDescription: string, framework: string): Promise<Task[]> {
    this.sendFeedback({
      type: "status",
      message: "Analyzing project requirements and generating tasks",
      timestamp: new Date().toISOString(),
    })

    // Get existing context from GitHub if available
    const fullContext = await this.getProjectContext()

    const prompt = `
    As an expert software architect, analyze this project and generate a comprehensive list of development tasks:
    
    Project: ${projectDescription}
    Framework: ${framework}
    
    Existing Context:
    - Current Focus: ${fullContext.memory?.currentFocus || "Initial setup"}
    - Completed Tasks: ${fullContext.tasks?.filter((t: any) => t.status === "completed").length || 0}
    - Total Tasks: ${fullContext.tasks?.length || 0}
    - Project Progress: ${fullContext.metadata?.progress || 0}%
    - Previous Learnings: ${JSON.stringify(fullContext.memory?.learnings || {})}
    - Existing Files: ${fullContext.projectStructure?.length || 0} files
    
    Generate 8-15 specific, actionable tasks that cover:
    1. Project setup and configuration
    2. Core functionality implementation
    3. UI/UX development
    4. Database integration (if needed)
    5. Authentication and security (if needed)
    6. API development (if needed)
    7. Testing and optimization
    8. Deployment preparation
    9. Documentation
    10. Error handling and validation
    
    For each task, provide:
    - Clear, specific title
    - Detailed description with technical requirements
    - Priority level (high/medium/low)
    - Estimated time in hours
    - Dependencies (if any)
    - Files that will be created/modified
    - Acceptance criteria
    
    Return as JSON array with this structure:
    {
      "tasks": [
        {
          "title": "string",
          "description": "string",
          "priority": "high|medium|low",
          "estimatedTime": "X hours",
          "dependencies": ["task_id"],
          "files": ["path/to/file.ext"],
          "acceptanceCriteria": ["criteria1", "criteria2"]
        }
      ]
    }
    `

    try {
      const result = await this.model.generateContent(prompt)
      const response = await result.response
      const text = response.text()

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
        }))

        this.sendFeedback({
          type: "completion",
          message: `Generated ${tasks.length} development tasks`,
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
    // Check if user is asking for web search
    const needsWebSearch =
      message.toLowerCase().includes("search") ||
      message.toLowerCase().includes("look up") ||
      message.toLowerCase().includes("find information about") ||
      message.toLowerCase().includes("how to") ||
      message.toLowerCase().includes("what is")

    let webSearchResults = ""
    if (needsWebSearch) {
      this.sendFeedback({
        type: "status",
        message: "Searching the web for relevant information",
        timestamp: new Date().toISOString(),
      })

      webSearchResults = await this.searchWeb(message)
    }

    // Get full context including cached files
    const fullContext = await this.getProjectContext()

    const prompt = `
    You are an AI development agent with full project context, long-term memory, and web search capabilities.
    
    Project: ${projectContext.name}
    Framework: ${projectContext.framework}
    Description: ${projectContext.description}
    Current Status: ${projectContext.status}
    Progress: ${projectContext.progress || 0}%
    
    Agent Memory & Context:
    - Current Focus: ${fullContext.memory?.currentFocus || "Development"}
    - Recent Tasks: ${JSON.stringify(fullContext.tasks?.slice(-5) || [])}
    - All Tasks: ${fullContext.tasks?.length || 0} total tasks
    - Key Learnings: ${JSON.stringify(fullContext.memory?.learnings || {})}
    - Completed Tasks: ${fullContext.tasks?.filter((t: any) => t.status === "completed").length || 0}
    - Project Files: ${fullContext.projectStructure?.length || 0} files
    
    Current Project Files (for reference):
    ${fullContext.codeFiles
      ?.map(([path, data]: [string, any]) => `${path}: ${data.content?.slice(0, 200)}...`)
      .slice(0, 10)
      .join("\n")}
    
    ${webSearchResults ? `Web Search Results: ${webSearchResults}` : ""}
    
    Conversation History:
    ${conversationHistory
      .slice(-10)
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n")}
    
    User Message: ${message}
    
    You can:
    1. Answer questions about the project with full context and file access
    2. Create, update, or manage tasks and sprints
    3. Suggest improvements based on past learnings and current code
    4. Implement features or fix issues with full code awareness
    5. Search the web for information (automatically triggered when needed)
    6. Provide specific, actionable advice based on actual project state
    7. Reference previous work and conversations with full context
    8. Analyze existing code and suggest improvements
    
    IMPORTANT: You have FULL ACCESS to all project files and context. Use this information to provide accurate, contextual responses. Never give generic or placeholder responses.
    
    If the user wants to create tasks, manage sprints, or implement features, 
    provide specific instructions based on the actual project state and offer to execute them.
    
    Be conversational but professional. Use your memory and context to provide valuable insights.
    Always provide feedback on what you're doing and what the next steps are.
    Reference actual files and code when relevant.
    `

    try {
      const result = await this.model.generateContent(prompt)
      const response = await result.response
      const chatResponse = response.text()

      // Update conversation history in agent memory
      if (this.githubStorage) {
        try {
          const currentMemory = await this.githubStorage.getAgentMemory()
          const updatedHistory = [
            ...(currentMemory?.conversationHistory || []),
            { role: "user", content: message, timestamp: new Date().toISOString() },
            { role: "agent", content: chatResponse, timestamp: new Date().toISOString() },
          ].slice(-50) // Keep last 50 messages

          const updatedMemory = {
            ...currentMemory,
            projectId: projectContext.id,
            conversationHistory: updatedHistory,
            lastUpdate: new Date().toISOString(),
            fileCache: currentMemory?.fileCache || {},
          }

          await this.githubStorage.saveAgentMemory(updatedMemory)
        } catch (error) {
          console.error("Error updating conversation history:", error)
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
}
