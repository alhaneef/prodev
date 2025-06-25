import { type NextRequest, NextResponse } from "next/server"
import { GitHubService } from "@/lib/github"
import { requireGitHubToken } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    console.log("Files API - Starting request")

    const { user, githubToken } = await requireGitHubToken(request)
    console.log("Files API - User authenticated:", user.email)

    const { searchParams } = new URL(request.url)
    const repository = searchParams.get("repository")
    const path = searchParams.get("path") || ""

    if (!repository) {
      return NextResponse.json({ success: false, error: "Repository parameter required" }, { status: 400 })
    }

    console.log("Files API - Repository:", repository, "Path:", path)

    const github = new GitHubService(githubToken)
    const [owner, repo] = repository.split("/").slice(-2)

    console.log("Files API - Owner:", owner, "Repo:", repo)

    // Get all files recursively
    const allFiles = await github.getAllRepositoryFiles(owner, repo, path)
    console.log("Files API - Found", allFiles.length, "files")

    // Organize files into a tree structure
    const fileTree = organizeFilesIntoTree(allFiles)

    return NextResponse.json({
      success: true,
      files: allFiles,
      tree: fileTree,
      count: allFiles.length,
    })
  } catch (error) {
    console.error("Files API error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch files",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, githubToken } = await requireGitHubToken(request)
    const { repository, path, content, message } = await request.json()

    if (!repository || !path || content === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: "Repository, path, and content are required",
        },
        { status: 400 },
      )
    }

    const github = new GitHubService(githubToken)
    const [owner, repo] = repository.split("/").slice(-2)

    try {
      // Try to get existing file first
      const existingFile = await github.getFileContent(owner, repo, path)
      // Update existing file
      await github.updateFile(owner, repo, path, content, message || "Update file", existingFile.sha)
    } catch (error) {
      // File doesn't exist, create new one
      await github.createFile(owner, repo, path, content, message || "Create file")
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Files POST API error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to save file",
      },
      { status: 500 },
    )
  }
}

function organizeFilesIntoTree(files: any[]): any {
  const tree: any = {}

  files.forEach((file) => {
    const parts = file.path.split("/")
    let current = tree

    parts.forEach((part, index) => {
      if (!current[part]) {
        current[part] = {
          name: part,
          path: parts.slice(0, index + 1).join("/"),
          type: index === parts.length - 1 ? file.type : "dir",
          children: {},
          size: file.size || 0,
          sha: file.sha,
        }
      }
      current = current[part].children
    })
  })

  return tree
}
