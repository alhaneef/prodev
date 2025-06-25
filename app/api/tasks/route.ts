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
      return NextResponse.json({ success: true, tasks })
    } catch (error) {
      return NextResponse.json({ success: true, tasks: [] })
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

    const { projectId, action, taskData, taskId, files, parentTaskId } = await request.json()

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
      switch (action) {
        case "create":
          if (!taskData?.title) {
            return NextResponse.json({ success: false, error: "Task title required" })
          }

          const newTask = {
            id: `task_${Date.now()}`,
            title: taskData.title,
            description: taskData.description || "",
            status: "pending" as const,
            priority: taskData.priority || "medium",
            type: "manual" as const,
            estimatedTime: taskData.estimatedTime || "2 hours",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            files: taskData.files || [],
            dependencies: taskData.dependencies || [],
            parentTaskId: parentTaskId || undefined,
          }

          await githubStorage.createTask(newTask)
          return NextResponse.json({ success: true, task: newTask })

        case "create_subtask":
          if (!parentTaskId || !taskData?.title) {
            return NextResponse.json({ success: false, error: "Parent task ID and subtask title required" })
          }

          const subtask = {
            id: `subtask_${Date.now()}`,
            title: taskData.title,
            description: taskData.description || "",
            status: "pending" as const,
            priority: taskData.priority || "medium",
            type: "manual" as const,
            estimatedTime: taskData.estimatedTime || "1 hour",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            files: taskData.files || [],
            dependencies: taskData.dependencies || [],
            parentTaskId,
          }

          await githubStorage.createTask(subtask)
          return NextResponse.json({ success: true, task: subtask })

        case "update_files":
          if (!taskId || !files) {
            return NextResponse.json({ success: false, error: "Task ID and files required" })
          }

          const tasks = await githubStorage.getTasks()
          const taskToUpdate = tasks.find((t) => t.id === taskId)

          if (!taskToUpdate) {
            return NextResponse.json({ success: false, error: "Task not found" })
          }

          const updatedTask = {
            ...taskToUpdate,
            files,
            updatedAt: new Date().toISOString(),
          }

          await githubStorage.updateTask(taskId, updatedTask)
          return NextResponse.json({ success: true, task: updatedTask })

        case "implement":
          if (!taskId) {
            return NextResponse.json({ success: false, error: "Task ID required" })
          }

          if (!credentials.gemini_api_key) {
            return NextResponse.json({ success: false, error: "Gemini API key required for implementation" })
          }

          const allTasks = await githubStorage.getTasks()
          const taskToImplement = allTasks.find((t) => t.id === taskId)

          if (!taskToImplement) {
            return NextResponse.json({ success: false, error: "Task not found" })
          }

          if (taskToImplement.status === "completed") {
            return NextResponse.json({ success: false, error: "Task already completed" })
          }

          // Mark task as in-progress
          await githubStorage.updateTask(taskId, { status: "in-progress" })

          try {
            const aiAgent = new AIAgent(credentials.gemini_api_key, githubStorage, github)

            console.log(`🤖 Starting implementation of task: ${taskToImplement.title}`)

            const implementation = await aiAgent.implementTask(taskToImplement, project)

            console.log(`✅ Implementation completed for task: ${taskToImplement.title}`)
            console.log(`📁 Files modified: ${implementation.files.length}`)

            // Mark task as completed
            await githubStorage.updateTask(taskId, {
              status: "completed",
              updatedAt: new Date().toISOString(),
            })

            return NextResponse.json({
              success: true,
              implementation,
              message: `Task "${taskToImplement.title}" implemented successfully`,
              filesModified: implementation.files.length,
            })
          } catch (error) {
            console.error(`❌ Implementation failed for task: ${taskToImplement.title}`, error)

            // Mark task as failed
            await githubStorage.updateTask(taskId, {
              status: "failed",
              updatedAt: new Date().toISOString(),
            })

            return NextResponse.json({
              success: false,
              error: `Implementation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            })
          }

        case "implement_all":
          if (!credentials.gemini_api_key) {
            return NextResponse.json({ success: false, error: "Gemini API key required for implementation" })
          }

          const allTasksList = await githubStorage.getTasks()
          const pendingTasks = allTasksList.filter((t) => t.status === "pending")

          if (pendingTasks.length === 0) {
            return NextResponse.json({ success: true, results: [], message: "No pending tasks to implement" })
          }

          console.log(`🤖 Starting implementation of ${pendingTasks.length} pending tasks`)

          const aiAgent = new AIAgent(credentials.gemini_api_key, githubStorage, github)
          const results = []

          // Implement tasks one by one to avoid overwhelming the system
          for (const task of pendingTasks.slice(0, 3)) {
            // Limit to 3 tasks at once
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
                taskId: task.id,
                title: task.title,
                status: "completed",
                files: implementation.files.length,
                message: implementation.message,
              })

              console.log(`✅ Completed task: ${task.title}`)
            } catch (error) {
              console.error(`❌ Failed to implement task: ${task.title}`, error)

              // Mark as failed
              await githubStorage.updateTask(task.id, {
                status: "failed",
                updatedAt: new Date().toISOString(),
              })

              results.push({
                taskId: task.id,
                title: task.title,
                status: "failed",
                error: error instanceof Error ? error.message : "Unknown error",
              })
            }
          }

          console.log(`🎉 Implementation batch completed. Results: ${results.length} tasks processed`)

          return NextResponse.json({
            success: true,
            results,
            message: `Processed ${results.length} tasks. ${results.filter((r) => r.status === "completed").length} completed, ${results.filter((r) => r.status === "failed").length} failed.`,
          })

        case "generate_ai_tasks":
          if (!credentials.gemini_api_key) {
            return NextResponse.json({ success: false, error: "Gemini API key required for AI task generation" })
          }

          console.log(`🤖 Generating AI tasks for project: ${project.name}`)

          const aiTaskAgent = new AIAgent(credentials.gemini_api_key, githubStorage, github)

          try {
            const generatedTasks = await aiTaskAgent.generateTasks(project.description, project.framework)

            // Save all generated tasks
            for (const task of generatedTasks) {
              await githubStorage.createTask(task)
            }

            console.log(`✅ Generated ${generatedTasks.length} AI tasks`)

            return NextResponse.json({
              success: true,
              tasks: generatedTasks,
              message: `Generated ${generatedTasks.length} AI tasks`,
            })
          } catch (error) {
            console.error("❌ AI task generation failed:", error)
            return NextResponse.json({
              success: false,
              error: `AI task generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            })
          }

        case "delete":
          if (!taskId) {
            return NextResponse.json({ success: false, error: "Task ID required" })
          }

          await githubStorage.deleteTask(taskId)
          return NextResponse.json({ success: true, message: "Task deleted successfully" })

        default:
          return NextResponse.json({ success: false, error: "Invalid action" })
      }
    } catch (error) {
      console.error("Tasks API error:", error)
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to process task request",
      })
    }
  } catch (error) {
    console.error("Tasks API error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to process request",
    })
  }
}
