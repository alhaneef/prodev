import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { GitHubService } from "@/lib/github-service"
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

    const github = new GitHubService(credentials.github_token)
    const [owner, repo] = project.repository.split("/").slice(-2)
    const githubStorage = new GitHubStorageService(github, owner, repo)

    try {
      const tasks = await githubStorage.getTasks()
      console.log("Tasks API - Found", tasks.length, "tasks")

      return NextResponse.json({
        success: true,
        tasks: tasks,
      })
    } catch (error) {
      console.error("Tasks API - Error getting tasks:", error)
      return NextResponse.json({
        success: true,
        tasks: [],
      })
    }
  } catch (error) {
    console.error("Tasks API error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get tasks",
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

    if (!credentials.gemini_api_key) {
      return NextResponse.json({ success: false, error: "Gemini API key required for AI features" })
    }

    const github = new GitHubService(credentials.github_token)
    const [owner, repo] = project.repository.split("/").slice(-2)
    const githubStorage = new GitHubStorageService(github, owner, repo)
    const aiAgent = new AIAgent(credentials.gemini_api_key, githubStorage, github)

    try {
      switch (action) {
        case "generate":
          console.log("Tasks API - Generating tasks for project:", project.name)
          const generatedTasks = await aiAgent.generateTasks(
            project.description || "Software development project",
            project.framework,
            "Generate comprehensive development tasks",
          )

          // Save generated tasks
          for (const task of generatedTasks) {
            await githubStorage.createTask(task)
          }

          console.log("Tasks API - Generated and saved", generatedTasks.length, "tasks")
          return NextResponse.json({
            success: true,
            tasks: generatedTasks,
            message: `Generated ${generatedTasks.length} tasks successfully`,
          })

        case "create":
          if (!taskData) {
            return NextResponse.json({ success: false, error: "Task data required" })
          }

          const newTask = {
            id: `task_${Date.now()}`,
            title: taskData.title,
            description: taskData.description,
            status: "pending" as const,
            priority: taskData.priority || "medium",
            type: "manual" as const,
            estimatedTime: taskData.estimatedTime || "2 hours",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            files: taskData.files || [],
            dependencies: taskData.dependencies || [],
            operations: taskData.operations || ["read"],
            acceptanceCriteria: taskData.acceptanceCriteria || [],
            technicalNotes: taskData.technicalNotes || "",
            context: taskData.context || "",
          }

          await githubStorage.createTask(newTask)
          console.log("Tasks API - Created task:", newTask.id)

          return NextResponse.json({
            success: true,
            task: newTask,
            message: "Task created successfully",
          })

        case "implement":
          if (!taskId) {
            return NextResponse.json({ success: false, error: "Task ID required" })
          }

          console.log("Tasks API - Implementing task:", taskId)
          const tasks = await githubStorage.getTasks()
          const taskToImplement = tasks.find((t) => t.id === taskId)

          if (!taskToImplement) {
            return NextResponse.json({ success: false, error: "Task not found" })
          }

          if (taskToImplement.status === "completed") {
            return NextResponse.json({ success: false, error: "Task already completed" })
          }

          // Mark as in-progress
          await githubStorage.updateTask(taskId, { status: "in-progress" })

          try {
            const implementation = await aiAgent.implementTask(taskToImplement, {
              id: project.id,
              name: project.name,
              description: project.description || "",
              framework: project.framework,
              repository: project.repository,
              progress: project.progress || 0,
            })

            // Mark as completed
            await githubStorage.updateTask(taskId, { status: "completed" })

            console.log("Tasks API - Task implemented successfully:", taskId)
            return NextResponse.json({
              success: true,
              implementation: implementation,
              filesModified: implementation.files.length,
              message: "Task implemented successfully",
            })
          } catch (implementError) {
            // Mark as failed
            await githubStorage.updateTask(taskId, { status: "failed" })
            throw implementError
          }

        case "implement_all":
          console.log("Tasks API - Implementing all pending tasks")
          const allTasks = await githubStorage.getTasks()
          const pendingTasks = allTasks.filter((t) => t.status === "pending")

          if (pendingTasks.length === 0) {
            return NextResponse.json({
              success: true,
              results: [],
              message: "No pending tasks to implement",
            })
          }

          const results = []
          for (const task of pendingTasks.slice(0, 5)) {
            // Limit to 5 tasks to prevent timeout
            try {
              console.log("Tasks API - Implementing task:", task.id)
              await githubStorage.updateTask(task.id, { status: "in-progress" })

              const implementation = await aiAgent.implementTask(task, {
                id: project.id,
                name: project.name,
                description: project.description || "",
                framework: project.framework,
                repository: project.repository,
                progress: project.progress || 0,
              })

              await githubStorage.updateTask(task.id, { status: "completed" })

              results.push({
                id: task.id,
                title: task.title,
                status: "completed",
                files: implementation.files.length,
              })
            } catch (error) {
              await githubStorage.updateTask(task.id, { status: "failed" })
              results.push({
                id: task.id,
                title: task.title,
                status: "failed",
                error: error instanceof Error ? error.message : "Unknown error",
              })
            }
          }

          console.log("Tasks API - Bulk implementation completed")
          return NextResponse.json({
            success: true,
            results: results,
            message: `Implemented ${results.filter((r) => r.status === "completed").length}/${results.length} tasks`,
          })

        default:
          return NextResponse.json({ success: false, error: "Invalid action" })
      }
    } catch (error) {
      console.error("Tasks API - Error:", error)
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : "Task operation failed",
      })
    }
  } catch (error) {
    console.error("Tasks API error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Internal server error",
    })
  }
}
