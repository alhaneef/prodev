import { type NextRequest, NextResponse } from "next/server"
import { getUserFromSession } from "@/lib/auth"
import { GitHubService } from "@/lib/github-service"
import { GitHubStorageService } from "@/lib/github-storage"
import { AIAgent } from "@/lib/ai-agent"

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromSession(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 })
    }

    if (!process.env.GITHUB_TOKEN) {
      return NextResponse.json({ error: "GitHub token not configured" }, { status: 500 })
    }

    const github = new GitHubService(process.env.GITHUB_TOKEN)
    const githubStorage = new GitHubStorageService(github, user.username, `prodev-${projectId}`)

    try {
      console.log(`Loading tasks for project ${projectId}...`)
      const tasks = await githubStorage.getTasks()
      console.log(`Found ${tasks.length} tasks`)

      return NextResponse.json({
        success: true,
        tasks: tasks || [],
        count: tasks?.length || 0,
      })
    } catch (error) {
      console.error("Error loading tasks:", error)
      return NextResponse.json({
        success: true,
        tasks: [],
        count: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  } catch (error) {
    console.error("Error in tasks GET API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromSession(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { projectId, action, taskId, taskData, parentTaskId, files, context } = body

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 })
    }

    if (!process.env.GITHUB_TOKEN) {
      return NextResponse.json({ error: "GitHub token not configured" }, { status: 500 })
    }

    const github = new GitHubService(process.env.GITHUB_TOKEN)
    const githubStorage = new GitHubStorageService(github, user.username, `prodev-${projectId}`)

    console.log(`Tasks API: ${action} for project ${projectId}`)

    switch (action) {
      case "create":
        if (!taskData) {
          return NextResponse.json({ error: "Task data is required" }, { status: 400 })
        }

        const newTask = {
          id: `task_${Date.now()}`,
          ...taskData,
          type: "manual" as const,
          status: "pending" as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        await githubStorage.createTask(newTask)
        console.log(`Created task: ${newTask.id}`)

        return NextResponse.json({ success: true, task: newTask })

      case "generate_ai_tasks":
        if (!process.env.GOOGLE_AI_API_KEY) {
          return NextResponse.json({ error: "AI service not configured" }, { status: 500 })
        }

        console.log("Generating AI tasks...")
        const aiAgent = new AIAgent(process.env.GOOGLE_AI_API_KEY, githubStorage, github)

        // Get or create project metadata
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

        const generatedTasks = await aiAgent.generateTasks(metadata.description, metadata.framework, context)
        console.log(`Generated ${generatedTasks.length} tasks`)

        // Save all generated tasks
        for (const task of generatedTasks) {
          await githubStorage.createTask(task)
        }

        return NextResponse.json({
          success: true,
          tasks: generatedTasks,
          count: generatedTasks.length,
        })

      case "implement":
        if (!taskId) {
          return NextResponse.json({ error: "Task ID is required" }, { status: 400 })
        }

        if (!process.env.GOOGLE_AI_API_KEY) {
          return NextResponse.json({ error: "AI service not configured" }, { status: 500 })
        }

        console.log(`Implementing task: ${taskId}`)

        const tasks = await githubStorage.getTasks()
        const task = tasks?.find((t) => t.id === taskId)
        if (!task) {
          return NextResponse.json({ error: "Task not found" }, { status: 404 })
        }

        // Mark as in-progress
        await githubStorage.updateTask(taskId, { status: "in-progress" })

        try {
          const aiAgent = new AIAgent(process.env.GOOGLE_AI_API_KEY, githubStorage, github)

          const metadata = await githubStorage.getProjectMetadata()
          const projectContext = {
            id: projectId,
            name: metadata?.name || "Project",
            description: metadata?.description || "",
            framework: metadata?.framework || "React",
            repository: `${user.username}/prodev-${projectId}`,
            progress: metadata?.progress || 0,
          }

          const implementation = await aiAgent.implementTask(task, projectContext)

          // Mark as completed
          await githubStorage.updateTask(taskId, { status: "completed" })
          console.log(`Task ${taskId} implemented successfully`)

          return NextResponse.json({
            success: true,
            implementation,
            task: { ...task, status: "completed" },
          })
        } catch (error) {
          console.error("Error implementing task:", error)

          // Mark as failed
          await githubStorage.updateTask(taskId, { status: "failed" })

          return NextResponse.json(
            {
              error: "Failed to implement task",
              details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 },
          )
        }

      case "implement_all":
        if (!process.env.GOOGLE_AI_API_KEY) {
          return NextResponse.json({ error: "AI service not configured" }, { status: 500 })
        }

        console.log("Implementing all pending tasks...")

        const allTasks = await githubStorage.getTasks()
        const pendingTasks = allTasks?.filter((t) => t.status === "pending") || []

        if (pendingTasks.length === 0) {
          return NextResponse.json({
            success: true,
            results: [],
            message: "No pending tasks to implement",
          })
        }

        console.log(`Found ${pendingTasks.length} pending tasks`)

        const aiAgentAll = new AIAgent(process.env.GOOGLE_AI_API_KEY, githubStorage, github)
        const metadataAll = await githubStorage.getProjectMetadata()
        const projectContextAll = {
          id: projectId,
          name: metadataAll?.name || "Project",
          description: metadataAll?.description || "",
          framework: metadataAll?.framework || "React",
          repository: `${user.username}/prodev-${projectId}`,
          progress: metadataAll?.progress || 0,
        }

        const results = []

        // Implement tasks sequentially to avoid conflicts
        for (const task of pendingTasks.slice(0, 5)) {
          // Limit to 5 tasks at once
          try {
            console.log(`Implementing task: ${task.id} - ${task.title}`)
            await githubStorage.updateTask(task.id, { status: "in-progress" })

            const implementation = await aiAgentAll.implementTask(task, projectContextAll)

            await githubStorage.updateTask(task.id, { status: "completed" })

            results.push({
              taskId: task.id,
              status: "completed",
              title: task.title,
              filesModified: implementation.files?.length || 0,
            })
          } catch (error) {
            console.error(`Error implementing task ${task.id}:`, error)

            await githubStorage.updateTask(task.id, { status: "failed" })

            results.push({
              taskId: task.id,
              status: "failed",
              title: task.title,
              error: error instanceof Error ? error.message : "Unknown error",
            })
          }
        }

        console.log(
          `Implementation complete: ${results.filter((r) => r.status === "completed").length} succeeded, ${results.filter((r) => r.status === "failed").length} failed`,
        )

        return NextResponse.json({
          success: true,
          results,
          completed: results.filter((r) => r.status === "completed").length,
          failed: results.filter((r) => r.status === "failed").length,
        })

      case "delete":
        if (!taskId) {
          return NextResponse.json({ error: "Task ID is required" }, { status: 400 })
        }

        await githubStorage.deleteTask(taskId)
        console.log(`Deleted task: ${taskId}`)

        return NextResponse.json({ success: true })

      case "update_files":
        if (!taskId || !files) {
          return NextResponse.json({ error: "Task ID and files are required" }, { status: 400 })
        }

        await githubStorage.updateTask(taskId, { files })
        return NextResponse.json({ success: true })

      case "create_subtask":
        if (!parentTaskId || !taskData) {
          return NextResponse.json({ error: "Parent task ID and task data are required" }, { status: 400 })
        }

        const subtask = {
          id: `subtask_${Date.now()}`,
          ...taskData,
          type: "manual" as const,
          status: "pending" as const,
          parentTaskId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        await githubStorage.createTask(subtask)
        return NextResponse.json({ success: true, subtask })

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Error in tasks POST API:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
