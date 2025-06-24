import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { githubStorage } from "@/lib/github"

export async function POST(req: NextRequest) {
  const { action, taskId, title, description, files } = await req.json()

  switch (action) {
    case "create":
      if (!title || !description) {
        return NextResponse.json({ success: false, error: "Title and description required" })
      }

      try {
        const task = await db.createTask({ title, description, files: files || [] })

        // Also save in GitHub storage
        const tasks = await githubStorage.getTasks()
        await githubStorage.saveTasks([...tasks, task])

        return NextResponse.json({ success: true, task })
      } catch (error) {
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : "Failed to create task",
        })
      }

    case "update":
      if (!taskId || !title || !description) {
        return NextResponse.json({ success: false, error: "Task ID, title, and description required" })
      }

      try {
        await db.updateTask(taskId, { title, description })

        // Also update in GitHub storage
        const tasks = await githubStorage.getTasks()
        const updatedTasks = tasks.map((task) => (task.id === taskId ? { ...task, title, description } : task))
        await githubStorage.saveTasks(updatedTasks)

        return NextResponse.json({
          success: true,
          message: "Task updated successfully",
        })
      } catch (error) {
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : "Failed to update task",
        })
      }

    case "update_files":
      if (!taskId) {
        return NextResponse.json({ success: false, error: "Task ID required" })
      }

      try {
        const tasks = await githubStorage.getTasks()
        const updatedTasks = tasks.map((task) =>
          task.id === taskId ? { ...task, files: files, updatedAt: new Date().toISOString() } : task,
        )

        await githubStorage.saveTasks(updatedTasks)

        return NextResponse.json({
          success: true,
          message: "Task files updated successfully",
        })
      } catch (error) {
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : "Failed to update task files",
        })
      }

    case "delete":
      if (!taskId) {
        return NextResponse.json({ success: false, error: "Task ID required" })
      }

      try {
        await db.deleteTask(taskId)

        // Also delete in GitHub storage
        const tasks = await githubStorage.getTasks()
        const updatedTasks = tasks.filter((task) => task.id !== taskId)
        await githubStorage.saveTasks(updatedTasks)

        return NextResponse.json({
          success: true,
          message: "Task deleted successfully",
        })
      } catch (error) {
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : "Failed to delete task",
        })
      }

    case "create_subtask":
      const { parentTaskId, taskData } = await req.json()

      if (!parentTaskId || !taskData.title) {
        return NextResponse.json({ success: false, error: "Parent task ID and title required" })
      }

      try {
        const subtask = {
          id: `task_${Date.now()}`,
          title: taskData.title,
          description: taskData.description,
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
            }
          }
          return task
        })

        await githubStorage.saveTasks(updatedTasks)

        return NextResponse.json({
          success: true,
          subtask,
        })
      } catch (error) {
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : "Failed to create subtask",
        })
      }

    default:
      return NextResponse.json({ success: false, error: "Invalid action" })
  }
}

export async function GET() {
  try {
    const tasks = await db.getTasks()
    return NextResponse.json({ success: true, tasks })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get tasks",
    })
  }
}
