import { type NextRequest, NextResponse } from "next/server"
import { getUser } from "@/lib/auth"
import { GitHubStorageService } from "@/lib/github-storage"

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")
    const filePath = searchParams.get("filePath")
    const includeContent = searchParams.get("includeContent") !== "false"

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 })
    }

    const githubStorage = new GitHubStorageService(process.env.GITHUB_TOKEN!, user.username, `prodev-${projectId}`)

    if (filePath) {
      // Get specific file content
      try {
        const content = await githubStorage.getFileContent(filePath)
        return NextResponse.json({
          success: true,
          content,
          path: filePath,
        })
      } catch (error) {
        return NextResponse.json({ error: "File not found" }, { status: 404 })
      }
    } else {
      // Get all files
      try {
        const files = await githubStorage.listFiles("", includeContent)
        return NextResponse.json({
          success: true,
          files,
        })
      } catch (error) {
        console.error("Error listing files:", error)
        return NextResponse.json({ error: "Failed to list files" }, { status: 500 })
      }
    }
  } catch (error) {
    console.error("Error in files API:", error)
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
    const { projectId, action, filePath, content, files } = body

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 })
    }

    const githubStorage = new GitHubStorageService(process.env.GITHUB_TOKEN!, user.username, `prodev-${projectId}`)

    switch (action) {
      case "create":
      case "update":
        if (!filePath || content === undefined) {
          return NextResponse.json({ error: "File path and content are required" }, { status: 400 })
        }
        try {
          await githubStorage.updateFileContent(filePath, content, `Update ${filePath}`)
          return NextResponse.json({ success: true })
        } catch (error) {
          console.error("Error updating file:", error)
          return NextResponse.json({ error: "Failed to update file" }, { status: 500 })
        }

      case "delete":
        if (!filePath) {
          return NextResponse.json({ error: "File path is required" }, { status: 400 })
        }
        try {
          await githubStorage.deleteFile(filePath, `Delete ${filePath}`)
          return NextResponse.json({ success: true })
        } catch (error) {
          console.error("Error deleting file:", error)
          return NextResponse.json({ error: "Failed to delete file" }, { status: 500 })
        }

      case "create_directory":
        if (!filePath) {
          return NextResponse.json({ error: "Directory path is required" }, { status: 400 })
        }
        try {
          // Create a .gitkeep file in the directory to ensure it exists
          await githubStorage.updateFileContent(`${filePath}/.gitkeep`, "", `Create directory ${filePath}`)
          return NextResponse.json({ success: true })
        } catch (error) {
          console.error("Error creating directory:", error)
          return NextResponse.json({ error: "Failed to create directory" }, { status: 500 })
        }

      case "bulk_update":
        if (!files || !Array.isArray(files)) {
          return NextResponse.json({ error: "Files array is required" }, { status: 400 })
        }
        try {
          // Update multiple files in batch
          for (const file of files) {
            if (file.path && file.content !== undefined) {
              await githubStorage.updateFileContent(file.path, file.content, "Bulk update")
            }
          }
          return NextResponse.json({ success: true })
        } catch (error) {
          console.error("Error bulk updating files:", error)
          return NextResponse.json({ error: "Failed to bulk update files" }, { status: 500 })
        }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Error in files POST API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
