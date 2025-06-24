import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { GitHubService } from "@/lib/github"
import JSZip from "jszip"

function getUserFromSession(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("user-session")?.value
    if (!sessionCookie) return null
    return JSON.parse(sessionCookie)
  } catch {
    return null
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = getUserFromSession(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const project = await db.getProject(params.id)
    if (!project || project.user_id !== user.id) {
      return NextResponse.json({ success: false, error: "Project not found" })
    }

    const credentials = await db.getCredentials(user.id)
    if (!credentials?.github_token) {
      return NextResponse.json({ success: false, error: "GitHub credentials required" })
    }

    const github = new GitHubService(credentials.github_token)
    const [owner, repo] = project.repository.split("/").slice(-2)

    // Get all files from repository
    const files = await getAllFiles(github, owner, repo)

    // Create ZIP file
    const zip = new JSZip()

    for (const file of files) {
      if (file.type === "file") {
        try {
          const content = await github.getFileContent(owner, repo, file.path)
          zip.file(file.path, content.content)
        } catch (error) {
          console.error(`Failed to get content for ${file.path}:`, error)
        }
      }
    }

    const zipBuffer = await zip.generateAsync({ type: "arraybuffer" })

    return new NextResponse(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${project.name}.zip"`,
      },
    })
  } catch (error) {
    console.error("Error downloading project:", error)
    return NextResponse.json({ success: false, error: "Failed to download project" })
  }
}

async function getAllFiles(github: GitHubService, owner: string, repo: string, path = ""): Promise<any[]> {
  try {
    const files = await github.listFiles(owner, repo, path)
    const allFiles = []

    for (const file of files) {
      allFiles.push(file)
      if (file.type === "dir") {
        const subFiles = await getAllFiles(github, owner, repo, file.path)
        allFiles.push(...subFiles)
      }
    }

    return allFiles
  } catch (error) {
    console.error(`Error getting files for ${path}:`, error)
    return []
  }
}
