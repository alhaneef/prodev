import { type NextRequest, NextResponse } from "next/server"
import { getUserFromSession } from "@/lib/auth"
import { GitHubService } from "@/lib/github-service"
import { db } from "@/lib/database"

interface FileTreeNode {
  name: string
  path: string
  type: "file" | "directory"
  size?: number
  children?: FileTreeNode[]
  lastModified?: string
}

function buildFileTree(files: any[]): FileTreeNode[] {
  const tree: FileTreeNode[] = []
  const pathMap = new Map<string, FileTreeNode>()

  // Sort files by path to ensure proper tree building
  files.sort((a, b) => a.path.localeCompare(b.path))

  for (const file of files) {
    const pathParts = file.path.split("/").filter(Boolean)
    let currentPath = ""
    let currentLevel = tree

    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i]
      currentPath = currentPath ? `${currentPath}/${part}` : part

      let node = pathMap.get(currentPath)

      if (!node) {
        const isLastPart = i === pathParts.length - 1
        const isFile = isLastPart && file.type === "file"

        node = {
          name: part,
          path: currentPath,
          type: isFile ? "file" : "directory",
          size: file.size,
          lastModified: file.lastModified || new Date().toISOString(),
          children: isFile ? undefined : [],
        }

        pathMap.set(currentPath, node)
        currentLevel.push(node)
      }

      if (node.children) {
        currentLevel = node.children
      }
    }
  }

  return tree
}

export async function GET(request: NextRequest) {
  try {
    console.log("Files API GET - Starting request")

    const user = getUserFromSession(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")
    const filePath = searchParams.get("filePath")
    const includeContent = searchParams.get("includeContent") === "true"

    console.log("Files API GET - ProjectId:", projectId, "FilePath:", filePath)

    if (!projectId) {
      return NextResponse.json(
        {
          success: false,
          error: "Project ID is required",
        },
        { status: 400 },
      )
    }

    // Get project from database
    const project = await db.getProject(projectId)
    if (!project || project.user_id !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: "Project not found or access denied",
        },
        { status: 404 },
      )
    }

    console.log("Files API GET - Project found:", project.name, "Repository:", project.repository)

    // Get user credentials
    const credentials = await db.getCredentials(user.id)
    if (!credentials?.github_token) {
      return NextResponse.json(
        {
          success: false,
          error: "GitHub credentials not configured",
        },
        { status: 400 },
      )
    }

    const github = new GitHubService(credentials.github_token)
    const [owner, repo] = project.repository.split("/").slice(-2)

    console.log("Files API GET - Owner:", owner, "Repo:", repo)

    try {
      if (filePath) {
        // Get specific file content
        console.log("Files API GET - Getting file content for:", filePath)
        const content = await github.getFileContent(owner, repo, filePath)
        return NextResponse.json({
          success: true,
          content: content.content,
          path: filePath,
        })
      } else {
        // Get ALL files recursively
        console.log("Files API GET - Getting all files recursively")
        const allFiles = await github.getAllRepositoryFiles(owner, repo)
        console.log("Files API GET - Found", allFiles.length, "total files")

        // Build file tree structure
        const fileTree = buildFileTree(allFiles)

        // Process files for response
        const processedFiles = allFiles.map((file) => ({
          name: file.name,
          path: file.path,
          type: file.type,
          size: file.size,
          lastModified: new Date().toISOString(),
        }))

        return NextResponse.json({
          success: true,
          files: processedFiles,
          fileTree,
          total: allFiles.length,
          directories: allFiles.filter((f) => f.type === "dir").length,
          regularFiles: allFiles.filter((f) => f.type === "file").length,
        })
      }
    } catch (error) {
      console.error("Files API GET - GitHub error:", error)
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch files from GitHub",
        files: [],
        fileTree: [],
        total: 0,
      })
    }
  } catch (error) {
    console.error("Files API GET - General error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromSession(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { projectId, action, filePath, content, files } = body

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

    switch (action) {
      case "save":
      case "create":
        if (!filePath || content === undefined) {
          return NextResponse.json({ error: "File path and content are required" }, { status: 400 })
        }

        try {
          // Try to get existing file first
          const existingFile = await github.getFileContent(owner, repo, filePath)
          await github.updateFile(owner, repo, filePath, content, `Update ${filePath}`, existingFile.sha)
        } catch (error) {
          // File doesn't exist, create new one
          await github.createFile(owner, repo, filePath, content, `Create ${filePath}`)
        }

        return NextResponse.json({ success: true })

      case "delete":
        if (!filePath) {
          return NextResponse.json({ error: "File path is required" }, { status: 400 })
        }

        try {
          const fileContent = await github.getFileContent(owner, repo, filePath)
          await github.deleteFile(owner, repo, filePath, `Delete ${filePath}`, fileContent.sha)
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
            try {
              const existingFile = await github.getFileContent(owner, repo, file.path)
              await github.updateFile(
                owner,
                repo,
                file.path,
                file.content,
                `Bulk update ${file.path}`,
                existingFile.sha,
              )
            } catch (error) {
              await github.createFile(owner, repo, file.path, file.content, `Bulk create ${file.path}`)
            }
            results.push({ path: file.path, success: true })
          } catch (error) {
            console.error(`Error updating file ${file.path}:`, error)
            results.push({
              path: file.path,
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            })
          }
        }

        return NextResponse.json({ success: true, results })

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Files API POST - Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
