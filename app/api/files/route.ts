import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { GitHubService } from "@/lib/github-service"

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
      return NextResponse.json({ success: false, error: "Project ID required" }, { status: 400 })
    }

    // Get project and verify ownership
    const project = await db.getProject(projectId)
    if (!project || project.user_id !== user.id) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 })
    }

    const credentials = await db.getCredentials(user.id)
    if (!credentials?.github_token) {
      return NextResponse.json({ success: false, error: "GitHub credentials required" }, { status: 400 })
    }

    const github = new GitHubService(credentials.github_token)
    const [owner, repo] = project.repository.split("/").slice(-2)

    try {
      console.log("Files API - Getting files for:", `${owner}/${repo}`)
      const files = await github.getAllRepositoryFiles(owner, repo)

      // Build file tree structure
      const fileTree = buildFileTree(files)

      console.log("Files API - Found", files.length, "files")

      return NextResponse.json({
        success: true,
        files: files,
        fileTree: fileTree,
        totalFiles: files.length,
      })
    } catch (error) {
      console.error("Files API - Error getting files:", error)
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to get files",
      })
    }
  } catch (error) {
    console.error("Files API error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    )
  }
}

function buildFileTree(files: any[]): any {
  const tree: any = {}

  for (const file of files) {
    const pathParts = file.path.split("/")
    let currentLevel = tree

    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i]

      if (i === pathParts.length - 1) {
        // It's a file
        currentLevel[part] = {
          type: "file",
          path: file.path,
          size: file.size,
          sha: file.sha,
        }
      } else {
        // It's a directory
        if (!currentLevel[part]) {
          currentLevel[part] = {
            type: "directory",
            children: {},
          }
        }
        currentLevel = currentLevel[part].children
      }
    }
  }

  return tree
}

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromSession(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { projectId, filePath, content, message } = await request.json()

    if (!projectId || !filePath) {
      return NextResponse.json({ success: false, error: "Project ID and file path required" }, { status: 400 })
    }

    // Get project and verify ownership
    const project = await db.getProject(projectId)
    if (!project || project.user_id !== user.id) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 })
    }

    const credentials = await db.getCredentials(user.id)
    if (!credentials?.github_token) {
      return NextResponse.json({ success: false, error: "GitHub credentials required" }, { status: 400 })
    }

    const github = new GitHubService(credentials.github_token)
    const [owner, repo] = project.repository.split("/").slice(-2)

    try {
      // Try to get existing file
      let sha: string | undefined
      try {
        const existingFile = await github.getFileContent(owner, repo, filePath)
        sha = existingFile.sha
      } catch (error) {
        // File doesn't exist, will create new
      }

      if (sha) {
        // Update existing file
        await github.updateFile(owner, repo, filePath, content || "", message || `Update ${filePath}`, sha)
      } else {
        // Create new file
        await github.createFile(owner, repo, filePath, content || "", message || `Create ${filePath}`)
      }

      return NextResponse.json({
        success: true,
        message: sha ? "File updated successfully" : "File created successfully",
      })
    } catch (error) {
      console.error("Files API - Error saving file:", error)
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to save file",
      })
    }
  } catch (error) {
    console.error("Files API error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    )
  }
}
