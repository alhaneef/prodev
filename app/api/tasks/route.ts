import { type NextRequest, NextResponse } from "next/server"
import { getUserFromSession } from "@/lib/auth"
import { GitHubService } from "@/lib/github-service"
import { GitHubStorageService } from "@/lib/github-storage"
import { AIAgent } from "@/lib/ai-agent"
import { db } from "@/lib/database"

export async function GET(request: NextRequest) {
  try {
    console.log("Tasks API GET - Starting request")

    const user = getUserFromSession(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 })
    }

    console.log("Tasks API GET - Project ID:", projectId)

    // Get project from database
    const project = await db.getProject(projectId)
    if (!project || project.user_id !== user.id) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Get user credentials
    const credentials = await db.getCredentials(user.id)
    if (!credentials?.github_token) {
      return NextResponse.json({ error: "GitHub credentials required" }, { status: 400 })
    }

    try {
      const github = new GitHubService(credentials.github_token)
      const [owner, repo] = project.repository.split("/").slice(-2)
      const githubStorage = new GitHubStorageService(github, owner, repo)

      console.log("Tasks API GET - Getting tasks from GitHub storage")
      const tasks = await githubStorage.getTasks()
      console.log("Tasks API GET - Found", tasks.length, "tasks")

      return NextResponse.json({
        success: true,
        tasks: tasks || [],
        count: tasks?.length || 0,
      })
    } catch (error) {
      console.error("Tasks API GET - Error:", error)
      return NextResponse.json({
        success: true,
        tasks: [],
        count: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  } catch (error) {
    console.error("Tasks API GET - General error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("Tasks API POST - Starting request")

    const user = getUserFromSession(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { projectId, action, taskId, taskData, context } = body

    console.log("Tasks API POST - Action:", action, "Project:", projectId)

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 })
    }

    // Get project from database
    const project = await db.getProject(projectId)
    if (!project || project.user_id !== user.id) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Get user credentials
    const credentials = await db.getCredentials(user.id)
    if (!credentials?.github_token) {
      return NextResponse.json({ error: "GitHub credentials required" }, { status: 400 })
    }

    const github = new GitHubService(credentials.github_token)
    const [owner, repo] = project.repository.split("/").slice(-2)
    const githubStorage = new GitHubStorageService(github, owner, repo)

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
        console.log("Tasks API POST - Created task:", newTask.id)

        return NextResponse.json({ success: true, task: newTask })

      case "generate_ai_tasks":
        if (!credentials.gemini_api_key) {
          return NextResponse.json({ error: "Gemini API key required for AI task generation" }, { status: 400 })
        }

        console.log("Tasks API POST - Generating AI tasks")
        const aiAgent = new AIAgent(credentials.gemini_api_key, githubStorage, github)

        // Get or create project metadata
        let metadata = await githubStorage.getProjectMetadata()
        if (!metadata) {
          metadata = {
            name: project.name,
            description: project.description || "A software project",
            framework: project.framework || "React",
            progress: 0,
            status: "active",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
          await githubStorage.saveProjectMetadata(metadata)
        }

        const generatedTasks = await aiAgent.generateTasks(metadata.description, metadata.framework, context)
        console.log("Tasks API POST - Generated", generatedTasks.length, "tasks")

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

        if (!credentials.gemini_api_key) {
          return NextResponse.json({ error: "Gemini API key required for task implementation" }, { status: 400 })
        }

        console.log("Tasks API POST - Implementing task:", taskId)

        const tasks = await githubStorage.getTasks()
        const task = tasks?.find((t) => t.id === taskId)
        if (!task) {
          return NextResponse.json({ error: "Task not found" }, { status: 404 })
        }

        // Mark as in-progress
        await githubStorage.updateTask(taskId, { status: "in-progress" })

        try {
          const aiAgentImpl = new AIAgent(credentials.gemini_api_key, githubStorage, github)

          const projectContext = {
            id: projectId,
            name: project.name,
            description: project.description || "",
            framework: project.framework || "React",
            repository: project.repository,
            progress: 0,
          }

          console.log("Tasks API POST - Starting task implementation")
          const implementation = await aiAgentImpl.implementTask(task, projectContext)

          // Mark as completed
          await githubStorage.updateTask(taskId, { status: "completed" })
          console.log("Tasks API POST - Task implemented successfully")

          return NextResponse.json({
            success: true,
            implementation,
            task: { ...task, status: "completed" },
            filesModified: implementation.files?.length || 0,
          })
        } catch (error) {
          console.error("Tasks API POST - Implementation error:", error)

          // Mark as failed
          await githubStorage.updateTask(taskId, { status: "failed" })

          return NextResponse.json(
            {
              success: false,
              error: "Failed to implement task",
              details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 },
          )
        }

      case "implement_all":
        if (!credentials.gemini_api_key) {
          return NextResponse.json({ error: "Gemini API key required for task implementation" }, { status: 400 })
        }

        console.log("Tasks API POST - Implementing all pending tasks")

        const allTasks = await githubStorage.getTasks()
        const pendingTasks = allTasks?.filter((t) => t.status === "pending") || []

        if (pendingTasks.length === 0) {
          return NextResponse.json({
            success: true,
            results: [],
            message: "No pending tasks to implement",
          })
        }

        console.log("Tasks API POST - Found", pendingTasks.length, "pending tasks")

        const aiAgentAll = new AIAgent(credentials.gemini_api_key, githubStorage, github)
        const projectContextAll = {
          id: projectId,
          name: project.name,
          description: project.description || "",
          framework: project.framework || "React",
          repository: project.repository,
          progress: 0,
        }

        const results = []

        // Implement tasks sequentially to avoid conflicts
        for (const taskToImpl of pendingTasks.slice(0, 5)) {
          // Limit to 5 tasks at once
          try {
            console.log("Tasks API POST - Implementing task:", taskToImpl.id, "-", taskToImpl.title)
            await githubStorage.updateTask(taskToImpl.id, { status: "in-progress" })

            const implementation = await aiAgentAll.implementTask(taskToImpl, projectContextAll)

            await githubStorage.updateTask(taskToImpl.id, { status: "completed" })

            results.push({
              taskId: taskToImpl.id,
              status: "completed",
              title: taskToImpl.title,
              filesModified: implementation.files?.length || 0,
            })
          } catch (error) {
            console.error("Tasks API POST - Error implementing task", taskToImpl.id, ":", error)

            await githubStorage.updateTask(taskToImpl.id, { status: "failed" })

            results.push({
              taskId: taskToImpl.id,
              status: "failed",
              title: taskToImpl.title,
              error: error instanceof Error ? error.message : "Unknown error",
            })
          }
        }

        console.log("Tasks API POST - Implementation complete:", results.length, "tasks processed")

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
        console.log("Tasks API POST - Deleted task:", taskId)

        return NextResponse.json({ success: true })

      case "update_files":
        if (!taskId || !body.files) {
          return NextResponse.json({ error: "Task ID and files are required" }, { status: 400 })
        }

        await githubStorage.updateTask(taskId, { files: body.files })
        return NextResponse.json({ success: true })

      case "create_subtask":
        if (!body.parentTaskId || !taskData) {
          return NextResponse.json({ error: "Parent task ID and task data are required" }, { status: 400 })
        }

        const subtask = {
          id: `subtask_${Date.now()}`,
          ...taskData,
          type: "manual" as const,
          status: "pending" as const,
          parentTaskId: body.parentTaskId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        await githubStorage.createTask(subtask)
        return NextResponse.json({ success: true, subtask })

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Tasks API POST - General error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
