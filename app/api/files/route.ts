import { type NextRequest, NextResponse } from "next/server"
import { getUserFromSession } from "@/lib/auth"
import { GitHubService } from "@/lib/github-service"
import { GitHubStorageService } from "@/lib/github-storage"

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
        // Get ALL files recursively
        console.log(`Loading all files for project ${projectId}...`)
        const allFiles = await githubStorage.getAllFiles()
        console.log(`Found ${allFiles.length} total files`)

        // Build file tree structure
        const fileTree = buildFileTree(allFiles)

        // If includeContent is true, load content for text files
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
      console.error("Error accessing files:", error)
      return NextResponse.json({
        success: true,
        files: [],
        fileTree: [],
        total: 0,
        error: error instanceof Error ? error.message : "Unknown error",
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
      case "create":
        if (!filePath || content === undefined) {
          return NextResponse.json({ error: "File path and content are required" }, { status: 400 })
        }

        await githubStorage.saveFileContent(
          filePath,
          content,
          `${action === "create" ? "Create" : "Update"} ${filePath}`,
        )
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
            results.push({
              path: file.path,
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            })
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
