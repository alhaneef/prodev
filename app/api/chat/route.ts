import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { AIAgent } from "@/lib/ai-agent"
import { GitHubService } from "@/lib/github"
import { GitHubStorageService } from "@/lib/github-storage"

function getUserFromSession(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("user-session")?.value
    if (!sessionCookie) return null
    return JSON.parse(sessionCookie)
  } catch {
    return null
  }
}

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

      return NextResponse.json({
        success: true,
        messages: messages.slice(-50), // Return last 50 messages
      })
    } catch (error) {
      return NextResponse.json({
        success: true,
        messages: [], // Return empty if no history
      })
    }
  } catch (error) {
    console.error("Chat GET API error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to load chat history",
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromSession(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { projectId, action, message, conversationHistory, taskId, replyTo } = await request.json()

    // Get project and verify ownership
    const project = await db.getProject(projectId)
    if (!project || project.user_id !== user.id) {
      return NextResponse.json({ success: false, error: "Project not found" })
    }

    const credentials = await db.getCredentials(user.id)
    if (!credentials) {
      return NextResponse.json({ success: false, error: "Credentials not found" })
    }

    // Initialize AI agent with GitHub access
    if (!credentials.github_token) {
      return NextResponse.json({ success: false, error: "GitHub credentials required" })
    }

    if (!credentials.gemini_api_key) {
      return NextResponse.json({ success: false, error: "Gemini API key required" })
    }

    const github = new GitHubService(credentials.github_token)
    const [owner, repo] = project.repository.split("/").slice(-2)
    const githubStorage = new GitHubStorageService(github, owner, repo)

    // Refresh file cache to ensure AI has latest files
    await githubStorage.refreshCache()

    const aiAgent = new AIAgent(credentials.gemini_api_key, githubStorage, github)

    try {
      switch (action) {
        case "chat":
          const response = await aiAgent.chatResponse(message, project, conversationHistory || [])

          // Handle special chat commands
          if (message.toLowerCase().includes("create task")) {
            // Extract task details and create task
            const taskTitle = message.match(/create task[:\s]+(.+)/i)?.[1] || "New Task"
            const newTask = {
              id: `task_${Date.now()}`,
              title: taskTitle,
              description: `Task created from chat: ${message}`,
              status: "pending",
              priority: "medium",
              type: "manual",
              estimatedTime: "2 hours",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }

            await githubStorage.createTask(newTask)

            return NextResponse.json({
              success: true,
              response: `${response}\n\n✅ Task created: "${taskTitle}"`,
              taskCreated: true,
            })
          }

          if (message.toLowerCase().includes("implement") && message.toLowerCase().includes("task")) {
            // Get tasks and implement them
            const tasks = await githubStorage.getTasks()
            const pendingTasks = tasks.filter((t) => t.status === "pending")

            if (pendingTasks.length > 0) {
              const taskToImplement = pendingTasks[0]

              try {
                const implementation = await aiAgent.implementTask(taskToImplement, project)

                // Apply the implementation to GitHub
                for (const file of implementation.files) {
                  if (file.operation === "create" || file.operation === "update") {
                    await githubStorage.updateFileContent(file.path, file.content, implementation.commitMessage)
                  }
                }

                // Mark task as completed
                await githubStorage.updateTask(taskToImplement.id, { status: "completed" })

                return NextResponse.json({
                  success: true,
                  response: `${response}\n\n✅ Task implemented: "${taskToImplement.title}"\n\nFiles updated:\n${implementation.files.map((f) => `- ${f.path}`).join("\n")}`,
                  taskImplemented: true,
                })
              } catch (error) {
                return NextResponse.json({
                  success: true,
                  response: `${response}\n\n❌ Failed to implement task: ${error instanceof Error ? error.message : "Unknown error"}`,
                })
              }
            }
          }

          return NextResponse.json({
            success: true,
            response,
          })

        case "implement_task":
          if (!taskId) {
            return NextResponse.json({ success: false, error: "Task ID required" })
          }

          const tasks = await githubStorage.getTasks()
          const task = tasks.find((t) => t.id === taskId)

          if (!task) {
            return NextResponse.json({ success: false, error: "Task not found" })
          }

          try {
            const implementation = await aiAgent.implementTask(task, project)

            // Apply the implementation to GitHub
            for (const file of implementation.files) {
              if (file.operation === "create" || file.operation === "update") {
                await githubStorage.updateFileContent(file.path, file.content, implementation.commitMessage)
              }
            }

            // Mark task as completed
            await githubStorage.updateTask(taskId, { status: "completed" })

            return NextResponse.json({
              success: true,
              implementation,
              message: "Task implemented successfully",
            })
          } catch (error) {
            return NextResponse.json({
              success: false,
              error: error instanceof Error ? error.message : "Implementation failed",
            })
          }

        case "implement_all":
          const allTasks = await githubStorage.getTasks()
          const pendingTasks = allTasks.filter((t) => t.status === "pending")
          const results = []

          for (const task of pendingTasks.slice(0, 5)) {
            // Limit to 5 tasks at once
            try {
              const implementation = await aiAgent.implementTask(task, project)

              // Apply the implementation to GitHub
              for (const file of implementation.files) {
                if (file.operation === "create" || file.operation === "update") {
                  await githubStorage.updateFileContent(file.path, file.content, implementation.commitMessage)
                }
              }

              // Mark task as completed
              await githubStorage.updateTask(task.id, { status: "completed" })

              results.push({
                taskId: task.id,
                title: task.title,
                status: "completed",
                files: implementation.files.length,
              })
            } catch (error) {
              results.push({
                taskId: task.id,
                title: task.title,
                status: "failed",
                error: error instanceof Error ? error.message : "Unknown error",
              })
            }
          }

          return NextResponse.json({
            success: true,
            results,
            message: `Processed ${results.length} tasks`,
          })

        default:
          return NextResponse.json({ success: false, error: "Invalid action" })
      }
    } catch (error) {
      console.error("Chat POST API error:", error)
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to process chat request",
      })
    }
  } catch (error) {
    console.error("Chat API error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to process request",
    })
  }
}
