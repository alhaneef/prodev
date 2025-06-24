import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { GitHubService } from "@/lib/github"
import { GitHubStorageService } from "@/lib/github-storage"
import { AIAgent } from "@/lib/ai-agent"

function getUserFromSession(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("user-session")?.value
    if (!sessionCookie) return null
    return JSON.parse(sessionCookie)
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromSession(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { projectId, error, platform } = await request.json()

    // Get project and verify ownership
    const project = await db.getProject(projectId)
    if (!project || project.user_id !== user.id) {
      return NextResponse.json({ success: false, error: "Project not found" })
    }

    const credentials = await db.getCredentials(user.id)
    if (!credentials?.gemini_api_key) {
      return NextResponse.json({ success: false, error: "Gemini API key required for AI fixes" })
    }

    if (!credentials.github_token) {
      return NextResponse.json({ success: false, error: "GitHub credentials required" })
    }

    // Initialize services
    const github = new GitHubService(credentials.github_token)
    const [owner, repo] = project.repository.split("/").slice(-2)
    const githubStorage = new GitHubStorageService(github, owner, repo)
    const agent = new AIAgent(credentials.gemini_api_key, githubStorage, github)

    // Get deployment fix from AI
    const fix = await agent.fixDeploymentError(error, {
      id: projectId,
      name: project.name,
      description: project.description,
      framework: project.framework,
      repository: project.repository,
      deploymentPlatform: platform,
      progress: project.progress || 0,
    })

    // Apply fixes to GitHub repository
    for (const file of fix.files) {
      try {
        const existingFile = await github.getFileContent(owner, repo, file.path)
        await github.updateFile(
          owner,
          repo,
          file.path,
          file.content,
          `🔧 Fix deployment error: ${error.substring(0, 50)}...`,
          existingFile.sha,
        )
      } catch (fileError) {
        // File might not exist, create it
        try {
          await github.createFile(
            owner,
            repo,
            file.path,
            file.content,
            `🔧 Create fix for deployment error: ${error.substring(0, 50)}...`,
          )
        } catch (createError) {
          console.error(`Error applying fix for ${file.path}:`, createError)
        }
      }
    }

    // Log the fix
    await githubStorage.saveDeploymentLog({
      timestamp: new Date().toISOString(),
      level: "info",
      message: "AI-generated deployment fix applied",
      details: {
        error,
        platform,
        filesFixed: fix.files.length,
        solution: fix.solution,
      },
    })

    return NextResponse.json({
      success: true,
      solution: fix.solution,
      filesFixed: fix.files.length,
    })
  } catch (error) {
    console.error("Deploy fix API error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate deployment fix",
    })
  }
}
