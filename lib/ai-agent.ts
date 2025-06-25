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

  async executeToolCall(toolCall: string, context: any): Promise<string> {
    try {
      // Parse the tool call
      if (toolCall.includes("web_search.search")) {
        const queryMatch = toolCall.match(/queries=\["([^"]+)"\]/)
        if (queryMatch) {
          const query = queryMatch[1]
          return await this.searchWeb(query)
        }
      }

      if (toolCall.includes('files["package.json"]')) {
        // Get package.json content from GitHub storage
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
        // Validate JSON content
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

      // Apply each file change
      for (const file of files) {
        try {
          if (file.operation === "create" || file.operation === "update") {
            await this.githubStorage.updateFileContent(file.path, file.content, commitMessage)
          } else if (file.operation === "delete") {
            // Handle file deletion if needed
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

    // Get full context including cached files
    const fullContext = await this.getProjectContext()

    const prompt = `
    You are an expert ${projectContext.framework} developer implementing a specific task.
    
    Task to Implement: ${task.title}
    Description: ${task.description}
    Priority: ${task.priority}
    Framework: ${projectContext.framework}
    Associated Files: ${task.files?.join(", ") || "None specified"}
    
    Project Context:
    - Name: ${projectContext.name}
    - Description: ${projectContext.description}
    - Repository: ${projectContext.repository}
    
    CRITICAL INSTRUCTIONS:
    1. You MUST return ONLY valid JSON in this exact format
    2. Do NOT include any markdown, explanations, or extra text
    3. Ensure all JSON strings are properly escaped
    4. Test your JSON before returning it
    
    Return this exact JSON structure:
    {
      "files": [
        {
          "path": "relative/path/to/file.ext",
          "content": "complete file content with proper escaping",
          "operation": "create"
        }
      ],
      "message": "Implementation summary",
      "commitMessage": "feat: descriptive commit message"
    }
    
    Generate a complete, functional implementation for this task.
    `

    try {
      this.sendFeedback({
        type: "progress",
        message: "Analyzing task and generating implementation",
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
    
    CRITICAL: Return ONLY valid JSON in this exact format:
    {
      "tasks": [
        {
          "title": "string",
          "description": "string",
          "priority": "high|medium|low",
          "estimatedTime": "X hours",
          "dependencies": [],
          "files": ["path/to/file.ext"],
          "acceptanceCriteria": ["criteria1", "criteria2"]
        }
      ]
    }
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
    9. Commit changes to GitHub automatically
    10. Deploy projects and fix deployment issues
    
    IMPORTANT: You have FULL ACCESS to all project files and context. Use this information to provide accurate, contextual responses. Never give generic or placeholder responses.
    
    If the user wants to create tasks, manage sprints, or implement features, 
    provide specific instructions based on the actual project state and offer to execute them.
    
    Be conversational but professional. Use your memory and context to provide valuable insights.
    Always provide feedback on what you're doing and what the next steps are.
    Reference actual files and code when relevant.
    
    If you mention you will do something (like "I'll check", "I'll validate", "I'll fix", "I'll deploy"), 
    you should actually execute those actions in your next response.
    `

    try {
      const result = await this.model.generateContent(prompt)
      const response = await result.response
      const chatResponse = response.text()

      // After generating the initial response, check for tool calls
      if (chatResponse.includes("```tool_code")) {
        const toolCallMatch = chatResponse.match(/```tool_code\n(.*?)\n```/s)
        if (toolCallMatch) {
          const toolCall = toolCallMatch[1]
          const toolResult = await this.executeToolCall(toolCall, fullContext)

          // Generate follow-up response with tool results
          const followUpPrompt = `
          Previous response: ${chatResponse}
          Tool execution result: ${toolResult}
          
          Continue the conversation naturally, incorporating the tool results and proceeding with the next logical step.
          `

          const followUpResult = await this.model.generateContent(followUpPrompt)
          const followUpResponse = await followUpResult.response
          return chatResponse + "\n\n" + followUpResponse.text()
        }
      }

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
