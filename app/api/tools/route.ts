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
    const { projectId, toolCall } = body

    if (!projectId || !toolCall) {
      return NextResponse.json({ error: "Project ID and tool call are required" }, { status: 400 })
    }

    if (!process.env.GITHUB_TOKEN || !process.env.GOOGLE_AI_API_KEY) {
      return NextResponse.json({ error: "Services not configured" }, { status: 500 })
    }

    const github = new GitHubService(process.env.GITHUB_TOKEN)
    const githubStorage = new GitHubStorageService(github, user.username, `prodev-${projectId}`)
    const aiAgent = new AIAgent(process.env.GOOGLE_AI_API_KEY, githubStorage, github)

    let result = ""

    if (toolCall.includes("list_files")) {
      result = await aiAgent.listAllFiles()
    } else if (toolCall.includes("execute_command")) {
      const commandMatch = toolCall.match(/command=["']([^"']+)["']/)
      if (commandMatch) {
        result = await aiAgent.executeTerminalCommand(commandMatch[1])
      }
    } else {
      result = "Tool call executed but no specific handler found"
    }

    return NextResponse.json({
      success: true,
      result,
      toolCall,
    })
  } catch (error) {
    console.error("Error in tools API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
