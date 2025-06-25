import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { GitHubService } from "@/lib/github"
import { getUserFromSession } from "@/lib/auth"

interface FileNode {
  name: string
  path: string
  type: "file" | "directory"
  children?: FileNode[]
  size?: number
  lastModified?: string
}

function buildFileTree(files: any[]): FileNode[] {
  const tree: FileNode[] = []
  const pathMap = new Map<string, FileNode>()

  // Sort files to ensure directories come before their contents
  files.sort((a, b) => {
    if (a.type === "dir" && b.type === "file") return -1
    if (a.type === "file" && b.type === "dir") return 1
    return a.path.localeCompare(b.path)
  })

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
        node = {
          name: part,
          path: currentPath,
          type: isLastPart && file.type === "file" ? "file" : "directory",
          children: isLastPart && file.type === "file" ? undefined : [],
          size: file.size,
          lastModified: file.lastModified,
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
    const user = getUserFromSession(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")
    const filePath = searchParams.get("filePath")
    const includeContent = searchParams.get("includeContent") !== "false"

    if (!projectId) {
      return NextResponse.json({ success: false, error: "Project ID required" })
    }

    // Verify project ownership
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

    if (filePath) {
      // Get specific file content
      try {
        const fileContent = await github.getFileContent(owner, repo, filePath)

        // Check if file is protected
        const protectedFiles = await getProtectedFiles(projectId)
        const isProtected = protectedFiles.includes(filePath)
        const isReadOnly = filePath.startsWith(".prodev/") || isProtected

        return NextResponse.json({
          success: true,
          content: fileContent.content,
          isProtected,
          isReadOnly,
        })
      } catch (error) {
        return NextResponse.json({
          success: false,
          error: `Failed to load file: ${error instanceof Error ? error.message : "Unknown error"}`,
        })
      }
    } else {
      // Get file tree
      try {
        const files = await github.listFiles(owner, repo)
        const fileTree = buildFileTree(files)

        return NextResponse.json({
          success: true,
          files: fileTree,
        })
      } catch (error) {
        return NextResponse.json({
          success: false,
          error: `Failed to load files: ${error instanceof Error ? error.message : "Unknown error"}`,
        })
      }
    }
  } catch (error) {
    console.error("Files API error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to process request",
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromSession(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { projectId, action, filePath, content, isProtected } = await request.json()

    // Verify project ownership
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

    switch (action) {
      case "update":
        // Check if file is protected
        const protectedFiles = await getProtectedFiles(projectId)
        if (protectedFiles.includes(filePath)) {
          return NextResponse.json({ success: false, error: "File is protected from editing" })
        }

        try {
          const existingFile = await github.getFileContent(owner, repo, filePath)
          await github.updateFile(owner, repo, filePath, content, `📝 Update ${filePath}`, existingFile.sha)

          // Log live update
          await logLiveUpdate(projectId, {
            type: "file_updated",
            path: filePath,
            message: `Updated ${filePath}`,
            timestamp: new Date().toISOString(),
          })

          return NextResponse.json({ success: true })
        } catch (error) {
          return NextResponse.json({
            success: false,
            error: `Failed to update file: ${error instanceof Error ? error.message : "Unknown error"}`,
          })
        }

      case "create":
        try {
          await github.createFile(owner, repo, filePath, content, `✨ Create ${filePath}`)

          // Log live update
          await logLiveUpdate(projectId, {
            type: "file_created",
            path: filePath,
            message: `Created ${filePath}`,
            timestamp: new Date().toISOString(),
          })

          return NextResponse.json({ success: true })
        } catch (error) {
          return NextResponse.json({
            success: false,
            error: `Failed to create file: ${error instanceof Error ? error.message : "Unknown error"}`,
          })
        }

      case "delete":
        // Check if file is protected
        const protectedFilesForDelete = await getProtectedFiles(projectId)
        if (protectedFilesForDelete.includes(filePath)) {
          return NextResponse.json({ success: false, error: "File is protected from deletion" })
        }

        try {
          const existingFile = await github.getFileContent(owner, repo, filePath)
          await github.updateFile(owner, repo, filePath, "", `🗑️ Delete ${filePath}`, existingFile.sha)

          // Log live update
          await logLiveUpdate(projectId, {
            type: "file_deleted",
            path: filePath,
            message: `Deleted ${filePath}`,
            timestamp: new Date().toISOString(),
          })

          return NextResponse.json({ success: true })
        } catch (error) {
          return NextResponse.json({
            success: false,
            error: `Failed to delete file: ${error instanceof Error ? error.message : "Unknown error"}`,
          })
        }

      case "protect":
        try {
          await setFileProtection(projectId, filePath, isProtected)
          return NextResponse.json({ success: true })
        } catch (error) {
          return NextResponse.json({
            success: false,
            error: `Failed to update protection: ${error instanceof Error ? error.message : "Unknown error"}`,
          })
        }

      default:
        return NextResponse.json({ success: false, error: "Invalid action" })
    }
  } catch (error) {
    console.error("Files POST API error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to process request",
    })
  }
}

// Helper functions
async function getProtectedFiles(projectId: string): Promise<string[]> {
  try {
    const protection = await db.query("SELECT protected_files FROM project_settings WHERE project_id = $1", [projectId])
    return protection.rows[0]?.protected_files || []
  } catch {
    return []
  }
}

async function setFileProtection(projectId: string, filePath: string, isProtected: boolean): Promise<void> {
  const currentProtected = await getProtectedFiles(projectId)

  let updatedProtected: string[]
  if (isProtected) {
    updatedProtected = [...currentProtected, filePath]
  } else {
    updatedProtected = currentProtected.filter((path) => path !== filePath)
  }

  await db.query(
    `INSERT INTO project_settings (project_id, protected_files) 
     VALUES ($1, $2) 
     ON CONFLICT (project_id) 
     DO UPDATE SET protected_files = $2`,
    [projectId, JSON.stringify(updatedProtected)],
  )
}

async function logLiveUpdate(projectId: string, update: any): Promise<void> {
  try {
    await db.query(
      `INSERT INTO live_updates (project_id, update_data, created_at) 
       VALUES ($1, $2, NOW())`,
      [projectId, JSON.stringify(update)],
    )
  } catch (error) {
    console.error("Error logging live update:", error)
  }
}
