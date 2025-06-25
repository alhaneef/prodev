import { type NextRequest, NextResponse } from "next/server"
import { getUserFromSession } from "@/lib/auth"
import { GitHubService } from "@/lib/github"
import { GitHubStorageService } from "@/lib/github-storage"
import { AIAgent } from "@/lib/ai-agent"

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromSession(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { projectId, command } = body

    if (!projectId || !command) {
      return NextResponse.json({ error: "Project ID and command are required" }, { status: 400 })
    }

    if (!process.env.GITHUB_TOKEN) {
      return NextResponse.json({ error: "GitHub token not configured" }, { status: 500 })
    }

    const github = new GitHubService(process.env.GITHUB_TOKEN)
    const githubStorage = new GitHubStorageService(github, user.username, `prodev-${projectId}`)

    if (process.env.GOOGLE_AI_API_KEY) {
      const aiAgent = new AIAgent(process.env.GOOGLE_AI_API_KEY, githubStorage, github)
      const output = await aiAgent.executeTerminalCommand(command)

      return NextResponse.json({
        success: true,
        output,
        command,
      })
    } else {
      return NextResponse.json({
        success: false,
        error: "AI service not configured",
      })
    }
  } catch (error) {
    console.error("Error in terminal API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
