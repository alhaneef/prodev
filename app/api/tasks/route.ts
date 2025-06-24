import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { GitHubService } from "@/lib/github"
import { GitHubStorageService } from "@/lib/github-storage"
import { AIAgent } from "@/lib/ai-agent"

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

    // Get tasks from GitHub storage
    const github = new GitHubService(credentials.github_token)
    const [owner, repo] = project.repository.split("/").slice(-2)
    const githubStorage = new GitHubStorageService(github, owner, repo)

    try {
      const tasks = await githubStorage.getTasks()
      return NextResponse.json({
        success: true,
        tasks,
      })
    } catch (error) {
      return NextResponse.json({
        success: true,
        tasks: [], // Return empty array if no tasks exist
      })
    }
  } catch (error) {
    console.error("Tasks GET API error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to load tasks",
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromSession(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { projectId, action, taskData, taskId } = await request.json()

    // Get project and verify ownership
    const project = await db.getProject(projectId)
    if (!project || project.user_id !== user.id) {
      return NextResponse.json({ success: false, error: "Project not found" })
    }

    const credentials = await db.getCredentials(user.id)
    if (!credentials?.github_token) {
      return NextResponse.json({ success: false, error: "GitHub credentials required" })
    }

    // Initialize GitHub storage
    const github = new GitHubService(credentials.github_token)
    const [owner, repo] = project.repository.split("/").slice(-2)
    const githubStorage = new GitHubStorageService(github, owner, repo)

    switch (action) {
      case "create":
        const newTask = {
          id: `task_${Date.now()}`,
          title: taskData.title,
          description: taskData.description,
          status: "pending",
          priority: taskData.priority || "medium",
          type: "manual",
          estimatedTime: taskData.estimatedTime || "2 hours",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          files: taskData.files || [],
          dependencies: taskData.dependencies || [],
        }

        await githubStorage.createTask(newTask)

        return NextResponse.json({
          success: true,
          task: newTask,
        })

      case "update":
        if (!taskId) {
          return NextResponse.json({ success: false, error: "Task ID required" })
        }

        await githubStorage.updateTask(taskId, {
          ...taskData,
          updatedAt: new Date().toISOString(),
        })

        return NextResponse.json({
          success: true,
          message: "Task updated successfully",
        })

      case "delete":
        if (!taskId) {
          return NextResponse.json({ success: false, error: "Task ID required" })
        }

        await githubStorage.deleteTask(taskId)

        return NextResponse.json({
          success: true,
          message: "Task deleted successfully",
        })

      case "implement":
        if (!taskId) {
          return NextResponse.json({ success: false, error: "Task ID required" })
        }

        if (!credentials.gemini_api_key) {
          return NextResponse.json({ success: false, error: "Gemini API key required" })
        }

        // Get the task
        const tasks = await githubStorage.getTasks()
        const task = tasks.find((t) => t.id === taskId)

        if (!task) {
          return NextResponse.json({ success: false, error: "Task not found" })
        }

        // Initialize AI agent
        await githubStorage.refreshCache()
        const aiAgent = new AIAgent(credentials.gemini_api_key, githubStorage, github)

        try {
          // Mark task as in progress
          await githubStorage.updateTask(taskId, { status: "in-progress" })

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
          // Mark task as failed
          await githubStorage.updateTask(taskId, { status: "failed" })

          return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Implementation failed",
          })
        }

      case "implement_all":
        if (!credentials.gemini_api_key) {
          return NextResponse.json({ success: false, error: "Gemini API key required" })
        }

        // Get all pending tasks
        const allTasks = await githubStorage.getTasks()
        const pendingTasks = allTasks.filter((t) => t.status === "pending")

        if (pendingTasks.length === 0) {
          return NextResponse.json({
            success: true,
            results: [],
            message: "No pending tasks to implement",
          })
        }

        // Initialize AI agent
        await githubStorage.refreshCache()
        const aiAgentAll = new AIAgent(credentials.gemini_api_key, githubStorage, github)

        const results = []

        // Process tasks one by one (limit to 5 to prevent timeout)
        for (const task of pendingTasks.slice(0, 5)) {
          try {
            // Mark task as in progress
            await githubStorage.updateTask(task.id, { status: "in-progress" })

            const implementation = await aiAgentAll.implementTask(task, project)

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
              message: implementation.message,
            })
          } catch (error) {
            // Mark task as failed
            await githubStorage.updateTask(task.id, { status: "failed" })

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
    console.error("Tasks POST API error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to process task request",
    })
  }
}
