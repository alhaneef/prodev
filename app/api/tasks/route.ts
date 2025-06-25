import { type NextRequest, NextResponse } from "next/server"
import { getUser } from "@/lib/auth"
import { GitHubStorageService } from "@/lib/github-storage"
import { GitHubService } from "@/lib/github"
import { AIAgent } from "@/lib/ai-agent"

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 })
    }

    const githubStorage = new GitHubStorageService(process.env.GITHUB_TOKEN!, user.username, `prodev-${projectId}`)

    try {
      const tasks = await githubStorage.getTasks()
      return NextResponse.json({
        success: true,
        tasks: tasks || [],
      })
    } catch (error) {
      console.error("Error loading tasks:", error)
      return NextResponse.json({
        success: true,
        tasks: [],
      })
    }
  } catch (error) {
    console.error("Error in tasks GET API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { projectId, action, taskId, taskData, parentTaskId, files, context } = body

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 })
    }

    const githubStorage = new GitHubStorageService(process.env.GITHUB_TOKEN!, user.username, `prodev-${projectId}`)

    const github = new GitHubService(process.env.GITHUB_TOKEN!)

    switch (action) {
      case "create":
        if (!taskData) {
          return NextResponse.json({ error: "Task data is required" }, { status: 400 })
        }
        try {
          const newTask = {
            id: `task_${Date.now()}`,
            ...taskData,
            type: "manual" as const,
            status: "pending" as const,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }

          const existingTasks = await githubStorage.getTasks()
          const updatedTasks = [...(existingTasks || []), newTask]
          await githubStorage.saveTasks(updatedTasks)

          return NextResponse.json({
            success: true,
            task: newTask,
          })
        } catch (error) {
          console.error("Error creating task:", error)
          return NextResponse.json({ error: "Failed to create task" }, { status: 500 })
        }

      case "generate_ai_tasks":
        try {
          if (!process.env.GOOGLE_AI_API_KEY) {
            return NextResponse.json({ error: "AI service not configured" }, { status: 500 })
          }

          const aiAgent = new AIAgent(process.env.GOOGLE_AI_API_KEY, githubStorage, github)

          // Get project metadata
          const metadata = await githubStorage.getProjectMetadata()
          const projectDescription = metadata?.description || "A software project"
          const framework = metadata?.framework || "React"

          // Generate tasks with context
          const generatedTasks = await aiAgent.generateTasks(projectDescription, framework, context)

          // Save generated tasks
          const existingTasks = await githubStorage.getTasks()
          const updatedTasks = [...(existingTasks || []), ...generatedTasks]
          await githubStorage.saveTasks(updatedTasks)

          return NextResponse.json({
            success: true,
            tasks: generatedTasks,
            count: generatedTasks.length,
          })
        } catch (error) {
          console.error("Error generating AI tasks:", error)
          return NextResponse.json({ error: "Failed to generate AI tasks" }, { status: 500 })
        }

      case "implement":
        if (!taskId) {
          return NextResponse.json({ error: "Task ID is required" }, { status: 400 })
        }
        try {
          if (!process.env.GOOGLE_AI_API_KEY) {
            return NextResponse.json({ error: "AI service not configured" }, { status: 500 })
          }

          const aiAgent = new AIAgent(process.env.GOOGLE_AI_API_KEY, githubStorage, github)

          // Get the task
          const tasks = await githubStorage.getTasks()
          const task = tasks?.find((t) => t.id === taskId)
          if (!task) {
            return NextResponse.json({ error: "Task not found" }, { status: 404 })
          }

          // Get project context
          const metadata = await githubStorage.getProjectMetadata()
          const projectContext = {
            id: projectId,
            name: metadata?.name || "Project",
            description: metadata?.description || "",
            framework: metadata?.framework || "React",
            repository: `${user.username}/prodev-${projectId}`,
            progress: metadata?.progress || 0,
          }

          // Implement the task
          const implementation = await aiAgent.implementTask(task, projectContext)

          // Update task status
          const updatedTasks = tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: "completed" as const,
                  updatedAt: new Date().toISOString(),
                }
              : t,
          )
          await githubStorage.saveTasks(updatedTasks)

          return NextResponse.json({
            success: true,
            implementation,
            task: updatedTasks.find((t) => t.id === taskId),
          })
        } catch (error) {
          console.error("Error implementing task:", error)

          // Mark task as failed
          try {
            const tasks = await githubStorage.getTasks()
            const updatedTasks = tasks?.map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    status: "failed" as const,
                    updatedAt: new Date().toISOString(),
                  }
                : t,
            )
            if (updatedTasks) {
              await githubStorage.saveTasks(updatedTasks)
            }
          } catch (updateError) {
            console.error("Error updating task status:", updateError)
          }

          return NextResponse.json({ error: "Failed to implement task" }, { status: 500 })
        }

      case "implement_all":
        try {
          if (!process.env.GOOGLE_AI_API_KEY) {
            return NextResponse.json({ error: "AI service not configured" }, { status: 500 })
          }

          const aiAgent = new AIAgent(process.env.GOOGLE_AI_API_KEY, githubStorage, github)

          // Get all pending tasks
          const tasks = await githubStorage.getTasks()
          const pendingTasks = tasks?.filter((t) => t.status === "pending") || []

          if (pendingTasks.length === 0) {
            return NextResponse.json({
              success: true,
              results: [],
              message: "No pending tasks to implement",
            })
          }

          // Get project context
          const metadata = await githubStorage.getProjectMetadata()
          const projectContext = {
            id: projectId,
            name: metadata?.name || "Project",
            description: metadata?.description || "",
            framework: metadata?.framework || "React",
            repository: `${user.username}/prodev-${projectId}`,
            progress: metadata?.progress || 0,
          }

          const results = []

          // Implement each task
          for (const task of pendingTasks) {
            try {
              await aiAgent.implementTask(task, projectContext)
              results.push({
                taskId: task.id,
                status: "completed",
                title: task.title,
              })
            } catch (error) {
              console.error(`Error implementing task ${task.id}:`, error)
              results.push({
                taskId: task.id,
                status: "failed",
                title: task.title,
                error: error instanceof Error ? error.message : "Unknown error",
              })
            }
          }

          // Update all task statuses
          const updatedTasks = tasks?.map((t) => {
            const result = results.find((r) => r.taskId === t.id)
            if (result) {
              return {
                ...t,
                status: result.status as any,
                updatedAt: new Date().toISOString(),
              }
            }
            return t
          })

          if (updatedTasks) {
            await githubStorage.saveTasks(updatedTasks)
          }

          return NextResponse.json({
            success: true,
            results,
            completed: results.filter((r) => r.status === "completed").length,
            failed: results.filter((r) => r.status === "failed").length,
          })
        } catch (error) {
          console.error("Error implementing all tasks:", error)
          return NextResponse.json({ error: "Failed to implement tasks" }, { status: 500 })
        }

      case "delete":
        if (!taskId) {
          return NextResponse.json({ error: "Task ID is required" }, { status: 400 })
        }
        try {
          const tasks = await githubStorage.getTasks()
          const updatedTasks = tasks?.filter((t) => t.id !== taskId) || []
          await githubStorage.saveTasks(updatedTasks)

          return NextResponse.json({ success: true })
        } catch (error) {
          console.error("Error deleting task:", error)
          return NextResponse.json({ error: "Failed to delete task" }, { status: 500 })
        }

      case "update_files":
        if (!taskId || !files) {
          return NextResponse.json({ error: "Task ID and files are required" }, { status: 400 })
        }
        try {
          const tasks = await githubStorage.getTasks()
          const updatedTasks = tasks?.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  files,
                  updatedAt: new Date().toISOString(),
                }
              : t,
          )
          if (updatedTasks) {
            await githubStorage.saveTasks(updatedTasks)
          }

          return NextResponse.json({ success: true })
        } catch (error) {
          console.error("Error updating task files:", error)
          return NextResponse.json({ error: "Failed to update task files" }, { status: 500 })
        }

      case "create_subtask":
        if (!parentTaskId || !taskData) {
          return NextResponse.json({ error: "Parent task ID and task data are required" }, { status: 400 })
        }
        try {
          const newSubtask = {
            id: `subtask_${Date.now()}`,
            ...taskData,
            type: "manual" as const,
            status: "pending" as const,
            parentTaskId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }

          const tasks = await githubStorage.getTasks()
          const updatedTasks = tasks?.map((t) => {
            if (t.id === parentTaskId) {
              return {
                ...t,
                subtasks: [...(t.subtasks || []), newSubtask],
                updatedAt: new Date().toISOString(),
              }
            }
            return t
          })

          if (updatedTasks) {
            await githubStorage.saveTasks(updatedTasks)
          }

          return NextResponse.json({
            success: true,
            subtask: newSubtask,
          })
        } catch (error) {
          console.error("Error creating subtask:", error)
          return NextResponse.json({ error: "Failed to create subtask" }, { status: 500 })
        }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Error in tasks POST API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
