import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { GitHubService } from "@/lib/github"
import { GitHubStorageService } from "@/lib/github-storage"
import { AIAgent } from "@/lib/ai-agent"
import { requireGitHubToken } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    console.log("Tasks API GET - Starting request")

    const { user, credentials, githubToken } = await requireGitHubToken(request)
    console.log("Tasks API GET - User authenticated:", user.email)

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")

    if (!projectId) {
      return NextResponse.json({ success: false, error: "Project ID required" }, { status: 400 })
    }

    console.log("Tasks API GET - Project ID:", projectId)

    // Get project and verify ownership
    const project = await db.getProject(projectId)
    if (!project || project.user_id !== user.id) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 })
    }

    console.log("Tasks API GET - Project found:", project.name)

    // Get tasks from database
    const dbTasks = await db.getProjectTasks(projectId)
    console.log("Tasks API GET - DB tasks count:", dbTasks.length)

    // Also try to get tasks from GitHub storage
    try {
      const github = new GitHubService(githubToken)
      const [owner, repo] = project.repository.split("/").slice(-2)
      const githubStorage = new GitHubStorageService(github, owner, repo)

      const githubTasks = await githubStorage.getTasks()
      console.log("Tasks API GET - GitHub tasks count:", githubTasks.length)

      // Merge tasks (prioritize GitHub storage)
      const allTasks = [...githubTasks]

      // Add DB tasks that aren't in GitHub
      dbTasks.forEach((dbTask) => {
        if (!githubTasks.find((gt) => gt.id === dbTask.id)) {
          allTasks.push(dbTask)
        }
      })

      console.log("Tasks API GET - Total merged tasks:", allTasks.length)

      return NextResponse.json({
        success: true,
        tasks: allTasks,
        count: allTasks.length,
      })
    } catch (githubError) {
      console.error("Tasks API GET - GitHub storage error:", githubError)
      // Fallback to DB tasks only
      return NextResponse.json({
        success: true,
        tasks: dbTasks,
        count: dbTasks.length,
      })
    }
  } catch (error) {
    console.error("Tasks API GET error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch tasks",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("Tasks API POST - Starting request")

    const { user, credentials, githubToken } = await requireGitHubToken(request)
    const body = await request.json()
    const { projectId, task, action } = body

    console.log("Tasks API POST - Action:", action, "Project:", projectId)

    if (!projectId) {
      return NextResponse.json({ success: false, error: "Project ID required" }, { status: 400 })
    }

    // Get project and verify ownership
    const project = await db.getProject(projectId)
    if (!project || project.user_id !== user.id) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 })
    }

    const github = new GitHubService(githubToken)
    const [owner, repo] = project.repository.split("/").slice(-2)
    const githubStorage = new GitHubStorageService(github, owner, repo)

    switch (action) {
      case "create":
        if (!task) {
          return NextResponse.json({ success: false, error: "Task data required" }, { status: 400 })
        }

        const newTask = {
          id: `task-${Date.now()}`,
          project_id: projectId,
          title: task.title,
          description: task.description || "",
          status: "pending" as const,
          priority: task.priority || ("medium" as const),
          type: task.type || ("manual" as const),
          estimated_time: task.estimated_time,
          assigned_agent: task.assigned_agent,
          files: task.files || [],
          dependencies: task.dependencies || [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        // Save to both DB and GitHub
        await db.createTask(newTask)
        await githubStorage.saveTask(newTask)

        console.log("Tasks API POST - Created task:", newTask.id)

        return NextResponse.json({
          success: true,
          task: newTask,
        })

      case "update":
        if (!task?.id) {
          return NextResponse.json({ success: false, error: "Task ID required" }, { status: 400 })
        }

        const updates = {
          ...task,
          updated_at: new Date().toISOString(),
        }

        // Update in both DB and GitHub
        await db.updateTask(task.id, updates)
        await githubStorage.updateTask(task.id, updates)

        console.log("Tasks API POST - Updated task:", task.id)

        return NextResponse.json({
          success: true,
          task: updates,
        })

      case "delete":
        if (!task?.id) {
          return NextResponse.json({ success: false, error: "Task ID required" }, { status: 400 })
        }

        // Delete from both DB and GitHub
        await db.deleteTask(task.id)
        await githubStorage.deleteTask(task.id)

        console.log("Tasks API POST - Deleted task:", task.id)

        return NextResponse.json({
          success: true,
        })

      case "implement":
        if (!task?.id) {
          return NextResponse.json({ success: false, error: "Task ID required" }, { status: 400 })
        }

        if (!credentials.gemini_api_key) {
          return NextResponse.json(
            {
              success: false,
              error: "Gemini API key required for task implementation",
            },
            { status: 400 },
          )
        }

        console.log("Tasks API POST - Implementing task:", task.id)

        // Initialize AI Agent
        const aiAgent = new AIAgent(credentials.gemini_api_key, githubStorage, github)

        // Implement the task
        const implementResult = await aiAgent.implementTask(task)

        if (implementResult.success) {
          // Update task status
          await db.updateTask(task.id, {
            status: "completed",
            updated_at: new Date().toISOString(),
          })
          await githubStorage.updateTask(task.id, {
            status: "completed",
            updated_at: new Date().toISOString(),
          })
        }

        return NextResponse.json({
          success: implementResult.success,
          message: implementResult.message,
          files: implementResult.files || [],
          commits: implementResult.commits || [],
        })

      case "implement-all":
        if (!credentials.gemini_api_key) {
          return NextResponse.json(
            {
              success: false,
              error: "Gemini API key required for task implementation",
            },
            { status: 400 },
          )
        }

        console.log("Tasks API POST - Implementing all pending tasks")

        // Get all pending tasks
        const pendingTasks = await db.getProjectTasks(projectId)
        const tasksToImplement = pendingTasks.filter((t) => t.status === "pending")

        if (tasksToImplement.length === 0) {
          return NextResponse.json({
            success: true,
            message: "No pending tasks to implement",
            implemented: 0,
          })
        }

        const aiAgent2 = new AIAgent(credentials.gemini_api_key, githubStorage, github)
        const results = []

        for (const taskToImplement of tasksToImplement) {
          try {
            const result = await aiAgent2.implementTask(taskToImplement)
            results.push({
              taskId: taskToImplement.id,
              success: result.success,
              message: result.message,
            })

            if (result.success) {
              await db.updateTask(taskToImplement.id, {
                status: "completed",
                updated_at: new Date().toISOString(),
              })
              await githubStorage.updateTask(taskToImplement.id, {
                status: "completed",
                updated_at: new Date().toISOString(),
              })
            }
          } catch (error) {
            results.push({
              taskId: taskToImplement.id,
              success: false,
              message: error instanceof Error ? error.message : "Implementation failed",
            })
          }
        }

        const successCount = results.filter((r) => r.success).length

        return NextResponse.json({
          success: true,
          message: `Implemented ${successCount}/${tasksToImplement.length} tasks`,
          implemented: successCount,
          total: tasksToImplement.length,
          results,
        })

      default:
        return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Tasks API POST error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to process task",
      },
      { status: 500 },
    )
  }
}
