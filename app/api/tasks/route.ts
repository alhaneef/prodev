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

    const { projectId, action, taskId, taskData, parentTaskId, files } = await request.json()

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
          if (!taskData?.title || !taskData?.description) {
            return NextResponse.json({ success: false, error: "Title and description required" })
          }

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
            subtasks: [],
          }

          await githubStorage.createTask(newTask)
          return NextResponse.json({ success: true, task: newTask })

        case "update":
          if (!taskId || !taskData?.title || !taskData?.description) {
            return NextResponse.json({ success: false, error: "Task ID, title, and description required" })
          }

          await githubStorage.updateTask(taskId, {
            title: taskData.title,
            description: taskData.description,
            priority: taskData.priority,
            estimatedTime: taskData.estimatedTime,
            updatedAt: new Date().toISOString(),
          })

          return NextResponse.json({ success: true, message: "Task updated successfully" })

        case "update_files":
          if (!taskId) {
            return NextResponse.json({ success: false, error: "Task ID required" })
          }

          await githubStorage.updateTask(taskId, {
            files: files || [],
            updatedAt: new Date().toISOString(),
          })

          return NextResponse.json({ success: true, message: "Task files updated successfully" })

        case "delete":
          if (!taskId) {
            return NextResponse.json({ success: false, error: "Task ID required" })
          }

          await githubStorage.deleteTask(taskId)
          return NextResponse.json({ success: true, message: "Task deleted successfully" })

        case "create_subtask":
          if (!parentTaskId || !taskData?.title) {
            return NextResponse.json({ success: false, error: "Parent task ID and title required" })
          }

          const subtask = {
            id: `task_${Date.now()}`,
            title: taskData.title,
            description: taskData.description || `Subtask of parent task`,
            status: "pending",
            priority: taskData.priority || "medium",
            type: "manual",
            estimatedTime: taskData.estimatedTime || "1 hour",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            parentTaskId,
            files: taskData.files || [],
            dependencies: taskData.dependencies || [],
          }

          // Get current tasks and add subtask to parent
          const tasks = await githubStorage.getTasks()
          const updatedTasks = tasks.map((task) => {
            if (task.id === parentTaskId) {
              return {
                ...task,
                subtasks: [...(task.subtasks || []), subtask],
                updatedAt: new Date().toISOString(),
              }
            }
            return task
          })

          await githubStorage.saveTasks(updatedTasks)
          return NextResponse.json({ success: true, subtask })

        case "implement":
          if (!taskId) {
            return NextResponse.json({ success: false, error: "Task ID required" })
          }

          if (!credentials.gemini_api_key) {
            return NextResponse.json({ success: false, error: "Gemini API key required" })
          }

          const allTasks = await githubStorage.getTasks()
          const task = allTasks.find((t) => t.id === taskId)

          if (!task) {
            return NextResponse.json({ success: false, error: "Task not found" })
          }

          // Mark task as in-progress
          await githubStorage.updateTask(taskId, { status: "in-progress" })

          try {
            const aiAgent = new AIAgent(credentials.gemini_api_key, githubStorage, github)
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

          const allTasksForImplementAll = await githubStorage.getTasks()
          const pendingTasks = allTasksForImplementAll.filter((t) => t.status === "pending")
          const results = []

          const aiAgent = new AIAgent(credentials.gemini_api_key, githubStorage, github)

          for (const task of pendingTasks.slice(0, 5)) {
            // Limit to 5 tasks at once
            try {
              // Mark task as in-progress
              await githubStorage.updateTask(task.id, { status: "in-progress" })

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

        case "generate_ai_tasks":
          if (!credentials.gemini_api_key) {
            return NextResponse.json({ success: false, error: "Gemini API key required" })
          }

          const aiAgentForGeneration = new AIAgent(credentials.gemini_api_key, githubStorage, github)
          const generatedTasks = await aiAgentForGeneration.generateTasks(project.description, project.framework)

          // Save generated tasks
          for (const task of generatedTasks) {
            await githubStorage.createTask(task)
          }

          return NextResponse.json({
            success: true,
            tasks: generatedTasks,
            message: `Generated ${generatedTasks.length} AI tasks`,
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
  } catch (error) {
    console.error("Tasks API error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to process request",
    })
  }
}
