import { type NextRequest, NextResponse } from "next/server"
import { getUserFromSession } from "@/lib/auth"
import { GitHubService } from "@/lib/github-service"
import { GitHubStorageService } from "@/lib/github-storage"
import { AIAgent } from "@/lib/ai-agent"
import { db } from "@/lib/db" // Declare the db variable

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromSession(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")

    if (!projectId) {
      return NextResponse.json({ success: false, error: "Project ID required" })
    }

    // Get project and verify ownership
    const project = await db.getProject(projectId)
    if (!project || project.user_id !== user.id) {
      return NextResponse.json({ success: false, error: "Project not found" })
    }

    const credentials = await db.getCredentials(user.id)
    if (!credentials?.github_token) {
      return NextResponse.json({ success: false, error: "GitHub credentials required" })
    }

    // Get chat history from GitHub storage
    const github = new GitHubService(credentials.github_token)
    const [owner, repo] = project.repository.split("/").slice(-2)
    const githubStorage = new GitHubStorageService(github, owner, repo)

    try {
      const memory = await githubStorage.getAgentMemory()
      const messages = memory?.conversationHistory || []
      return NextResponse.json({ success: true, messages })
    } catch (error) {
      return NextResponse.json({ success: true, messages: [] })
    }
  } catch (error) {
    console.error("Chat GET API error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get chat history",
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromSession(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { projectId, message, conversationHistory } = body

    if (!projectId || !message) {
      return NextResponse.json({ error: "Project ID and message are required" }, { status: 400 })
    }

    if (!process.env.GITHUB_TOKEN) {
      return NextResponse.json({ error: "GitHub token not configured" }, { status: 500 })
    }

    if (!process.env.GOOGLE_AI_API_KEY) {
      return NextResponse.json({ error: "AI service not configured" }, { status: 500 })
    }

    const github = new GitHubService(process.env.GITHUB_TOKEN)
    const githubStorage = new GitHubStorageService(github, user.username, `prodev-${projectId}`)
    const aiAgent = new AIAgent(process.env.GOOGLE_AI_API_KEY, githubStorage, github)

    // Get project context
    let metadata = await githubStorage.getProjectMetadata()
    if (!metadata) {
      metadata = {
        name: `Project ${projectId}`,
        description: "A software project",
        framework: "React",
        progress: 0,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      await githubStorage.saveProjectMetadata(metadata)
    }

    const projectContext = {
      id: projectId,
      name: metadata.name,
      description: metadata.description,
      framework: metadata.framework,
      repository: `${user.username}/prodev-${projectId}`,
      progress: metadata.progress,
    }

    // Generate AI response
    const response = await aiAgent.chatResponse(message, projectContext, conversationHistory || [])

    // Save conversation to memory
    try {
      const memory = await githubStorage.getAgentMemory()
      const updatedHistory = [
        ...(memory?.conversationHistory || []),
        {
          role: "user",
          content: message,
          timestamp: new Date().toISOString(),
        },
        {
          role: "assistant",
          content: response,
          timestamp: new Date().toISOString(),
        },
      ].slice(-50) // Keep last 50 messages

      const updatedMemory = {
        projectId,
        conversationHistory: updatedHistory,
        taskHistory: memory?.taskHistory || [],
        codeContext: memory?.codeContext || [],
        learnings: memory?.learnings || {},
        currentFocus: "Development",
        lastUpdate: new Date().toISOString(),
        fileCache: memory?.fileCache || {},
        codebaseIndex: memory?.codebaseIndex || {},
        userPreferences: memory?.userPreferences || {},
        projectInsights: memory?.projectInsights || {},
      }

      await githubStorage.saveAgentMemory(updatedMemory)
    } catch (error) {
      console.error("Error saving conversation memory:", error)
    }

    return NextResponse.json({
      success: true,
      response,
      metadata: {
        hasActions: response.includes("implement") || response.includes("create"),
        executedCommands: (response.match(/```bash/g) || []).length,
        filesModified: (response.match(/```[a-z]+\s+file=/g) || []).length,
      },
    })
  } catch (error) {
    console.error("Error in chat API:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

async function handleAutonomousFollowUp(
  message: string,
  conversationHistory: any[],
  aiAgent: AIAgent,
  project: any,
  githubStorage: GitHubStorageService,
  github: GitHubService,
  credentials: any,
): Promise<{ response: string; needsMoreFollowUp: boolean }> {
  // Get the last agent message to understand what it planned to do
  const lastAgentMessage = conversationHistory.filter((msg) => msg.role === "assistant").pop()?.content || ""

  let response = ""
  let needsMoreFollowUp = false

  try {
    console.log("🤖 Autonomous follow-up triggered for:", lastAgentMessage.slice(0, 100))

    // Check what the agent said it would do and execute it
    if (lastAgentMessage.includes("I'll check") || lastAgentMessage.includes("I'll examine")) {
      // Execute file checking/examination
      if (lastAgentMessage.includes("package.json")) {
        try {
          const packageContent = await githubStorage.getFileContent("package.json")
          const isValidJson = (() => {
            try {
              JSON.parse(packageContent)
              return true
            } catch {
              return false
            }
          })()

          response = `✅ Examined package.json:\n- File exists: Yes\n- Valid JSON: ${isValidJson ? "Yes" : "No"}\n- Size: ${packageContent.length} characters`

          if (!isValidJson) {
            response += "\n\n❌ Found JSON parsing issue. I'll fix this now..."
            needsMoreFollowUp = true
          }
        } catch (error) {
          response = `❌ Error examining package.json: ${error instanceof Error ? error.message : "Unknown error"}`
        }
      }
    }

    if (lastAgentMessage.includes("I'll implement") || lastAgentMessage.includes("implement all")) {
      // Execute task implementation
      response = "🔨 Starting task implementation...\n\n"

      try {
        // Get pending tasks
        const tasks = await githubStorage.getTasks()
        const pendingTasks = tasks.filter((t) => t.status === "pending")

        if (pendingTasks.length === 0) {
          response += "ℹ️ No pending tasks found to implement."
        } else {
          response += `📋 Found ${pendingTasks.length} pending tasks. Implementing now...\n\n`

          // Implement tasks (limit to 2 for autonomous execution)
          const tasksToImplement = pendingTasks.slice(0, 2)
          const results = []

          for (const task of tasksToImplement) {
            try {
              console.log(`🔨 Implementing task: ${task.title}`)

              // Mark as in-progress
              await githubStorage.updateTask(task.id, { status: "in-progress" })

              const implementation = await aiAgent.implementTask(task, project)

              // Mark as completed
              await githubStorage.updateTask(task.id, {
                status: "completed",
                updatedAt: new Date().toISOString(),
              })

              results.push({
                title: task.title,
                status: "completed",
                files: implementation.files.length,
              })

              response += `✅ Completed: ${task.title} (${implementation.files.length} files)\n`
            } catch (error) {
              console.error(`❌ Failed to implement task: ${task.title}`, error)

              // Mark as failed
              await githubStorage.updateTask(task.id, {
                status: "failed",
                updatedAt: new Date().toISOString(),
              })

              results.push({
                title: task.title,
                status: "failed",
                error: error instanceof Error ? error.message : "Unknown error",
              })

              response += `❌ Failed: ${task.title} - ${error instanceof Error ? error.message : "Unknown error"}\n`
            }
          }

          const completedCount = results.filter((r) => r.status === "completed").length
          response += `\n🎉 Implementation completed: ${completedCount}/${tasksToImplement.length} tasks successful`
        }
      } catch (error) {
        response += `❌ Error during implementation: ${error instanceof Error ? error.message : "Unknown error"}`
      }
    }

    if (lastAgentMessage.includes("I'll fix") || lastAgentMessage.includes("I'll validate")) {
      // Execute fixing actions
      response = "🔧 Applying fixes to the codebase...\n\n"

      try {
        // Get current files and apply basic fixes
        const files = await github.listFiles(
          project.repository.split("/").slice(-2)[0],
          project.repository.split("/").slice(-2)[1],
        )

        // Check for common issues and fix them
        let fixesApplied = 0

        for (const file of files.slice(0, 5)) {
          // Limit to prevent timeout
          if (
            file.type === "file" &&
            (file.path.endsWith(".json") || file.path.endsWith(".js") || file.path.endsWith(".ts"))
          ) {
            try {
              const content = await github.getFileContent(
                project.repository.split("/").slice(-2)[0],
                project.repository.split("/").slice(-2)[1],
                file.path,
              )

              // Basic JSON validation and fixing
              if (file.path.endsWith(".json")) {
                try {
                  JSON.parse(content.content)
                } catch (jsonError) {
                  // Try to fix common JSON issues
                  const fixedContent = content.content
                    .replace(/,(\s*[}\]])/g, "$1") // Remove trailing commas
                    .replace(/'/g, '"') // Replace single quotes with double quotes

                  try {
                    JSON.parse(fixedContent)
                    await githubStorage.updateFileContent(file.path, fixedContent, `🔧 Fix JSON syntax in ${file.path}`)
                    fixesApplied++
                    response += `✅ Fixed JSON syntax in ${file.path}\n`
                  } catch {
                    response += `❌ Could not auto-fix ${file.path}\n`
                  }
                }
              }
            } catch (error) {
              // Continue with other files
            }
          }
        }

        response += `\n🎉 Applied ${fixesApplied} fixes to the codebase.`

        if (fixesApplied > 0) {
          response += "\n\nFiles have been committed to GitHub. Ready for deployment!"
        }
      } catch (error) {
        response += `\n❌ Error during fixing: ${error instanceof Error ? error.message : "Unknown error"}`
      }
    }

    if (lastAgentMessage.includes("I'll deploy") || lastAgentMessage.includes("I'll redeploy")) {
      // Execute deployment
      response = "🚀 Starting deployment...\n\n"

      try {
        // Trigger deployment via internal API call
        const deployResponse = await fetch(`${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/deploy`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: project.id, platform: "vercel" }),
        })

        const deployResult = await deployResponse.json()

        if (deployResult.success) {
          response += `✅ Deployment successful!\n🌐 Live URL: ${deployResult.deploymentUrl}`
        } else {
          response += `❌ Deployment failed: ${deployResult.error}\n\nI'll analyze the error and try to fix it...`
          needsMoreFollowUp = true
        }
      } catch (error) {
        response += `❌ Deployment error: ${error instanceof Error ? error.message : "Unknown error"}`
      }
    }

    if (lastAgentMessage.includes("I'll search") || lastAgentMessage.includes("I'll look up")) {
      // Execute web search
      const searchQuery =
        lastAgentMessage.match(/search.*?for\s+(.+?)(?:\.|$)/i)?.[1] ||
        lastAgentMessage.match(/look up\s+(.+?)(?:\.|$)/i)?.[1] ||
        "deployment best practices"

      response = `🔍 Searching for: ${searchQuery}\n\n`

      try {
        const searchResults = await aiAgent.searchWeb(searchQuery)
        response += searchResults
      } catch (error) {
        response += `❌ Search error: ${error instanceof Error ? error.message : "Unknown error"}`
      }
    }

    // If no specific action was detected, provide a general follow-up
    if (!response) {
      response =
        "I'm continuing to work on your request. Let me analyze the current state and proceed with the next steps..."

      // Get project status and provide relevant next steps
      try {
        const tasks = await githubStorage.getTasks()
        const pendingTasks = tasks.filter((t) => t.status === "pending")

        if (pendingTasks.length > 0) {
          response += `\n\n📋 I found ${pendingTasks.length} pending tasks. Would you like me to implement them?`
        } else {
          response += "\n\n✅ All tasks are completed. Ready for deployment or additional features!"
        }
      } catch (error) {
        response += "\n\nI'm ready to help with your next request!"
      }
    }

    console.log("✅ Autonomous follow-up completed:", response.slice(0, 100))

    return { response, needsMoreFollowUp }
  } catch (error) {
    console.error("❌ Autonomous follow-up error:", error)
    return {
      response: `❌ Error during autonomous follow-up: ${error instanceof Error ? error.message : "Unknown error"}`,
      needsMoreFollowUp: false,
    }
  }
}
