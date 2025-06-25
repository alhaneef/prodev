import { type NextRequest, NextResponse } from "next/server"
import { getUserFromSession } from "@/lib/auth"
import { GitHubService } from "@/lib/github"
import { GitHubStorageService } from "@/lib/github-storage"

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromSession(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")
    const filePath = searchParams.get("filePath")
    const includeContent = searchParams.get("includeContent") === "true"

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 })
    }

    if (!process.env.GITHUB_TOKEN) {
      return NextResponse.json({ error: "GitHub token not configured" }, { status: 500 })
    }

    const github = new GitHubService(process.env.GITHUB_TOKEN)
    const githubStorage = new GitHubStorageService(github, user.username, `prodev-${projectId}`)

    try {
      if (filePath) {
        // Get specific file content
        const content = await githubStorage.getFileContent(filePath)
        return NextResponse.json({
          success: true,
          content,
          path: filePath,
        })
      } else {
        // Get all files
        const allFiles = await githubStorage.getAllFiles()

        // Process files to include content if requested
        const processedFiles = await Promise.all(
          allFiles.map(async (file) => {
            const processedFile = {
              name: file.name,
              path: file.path,
              type: file.type,
              size: file.size,
              lastModified: new Date().toISOString(),
            }

            if (includeContent && file.type === "file") {
              try {
                const content = await githubStorage.getFileContent(file.path)
                return { ...processedFile, content }
              } catch (error) {
                console.error(`Error getting content for ${file.path}:`, error)
                return processedFile
              }
            }

            return processedFile
          }),
        )

        return NextResponse.json({
          success: true,
          files: processedFiles,
          total: processedFiles.length,
        })
      }
    } catch (error) {
      console.error("Error accessing files:", error)
      return NextResponse.json({
        success: true,
        files: [],
        total: 0,
      })
    }
  } catch (error) {
    console.error("Error in files API:", error)
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
    const { projectId, action, filePath, content, files } = body

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 })
    }

    if (!process.env.GITHUB_TOKEN) {
      return NextResponse.json({ error: "GitHub token not configured" }, { status: 500 })
    }

    const github = new GitHubService(process.env.GITHUB_TOKEN)
    const githubStorage = new GitHubStorageService(github, user.username, `prodev-${projectId}`)

    switch (action) {
      case "save":
        if (!filePath || content === undefined) {
          return NextResponse.json({ error: "File path and content are required" }, { status: 400 })
        }

        await githubStorage.saveFileContent(filePath, content, `Update ${filePath}`)
        return NextResponse.json({ success: true })

      case "create":
        if (!filePath || content === undefined) {
          return NextResponse.json({ error: "File path and content are required" }, { status: 400 })
        }

        await githubStorage.saveFileContent(filePath, content, `Create ${filePath}`)
        return NextResponse.json({ success: true })

      case "delete":
        if (!filePath) {
          return NextResponse.json({ error: "File path is required" }, { status: 400 })
        }

        try {
          const fileContent = await github.getFileContent(user.username, `prodev-${projectId}`, filePath)
          await github.deleteFile(user.username, `prodev-${projectId}`, filePath, `Delete ${filePath}`, fileContent.sha)
          return NextResponse.json({ success: true })
        } catch (error) {
          console.error("Error deleting file:", error)
          return NextResponse.json({ error: "Failed to delete file" }, { status: 500 })
        }

      case "bulk_update":
        if (!files || !Array.isArray(files)) {
          return NextResponse.json({ error: "Files array is required" }, { status: 400 })
        }

        const results = []
        for (const file of files) {
          try {
            await githubStorage.saveFileContent(file.path, file.content, `Bulk update ${file.path}`)
            results.push({ path: file.path, success: true })
          } catch (error) {
            console.error(`Error updating file ${file.path}:`, error)
            results.push({ path: file.path, success: false, error: error.message })
          }
        }

        return NextResponse.json({ success: true, results })

      case "create_directory":
        if (!filePath) {
          return NextResponse.json({ error: "Directory path is required" }, { status: 400 })
        }

        // Create a .gitkeep file in the directory to ensure it exists
        const gitkeepPath = `${filePath}/.gitkeep`
        await githubStorage.saveFileContent(gitkeepPath, "", `Create directory ${filePath}`)
        return NextResponse.json({ success: true })

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Error in files POST API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
