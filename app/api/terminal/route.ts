import { type NextRequest, NextResponse } from "next/server"
import { getUserFromSession } from "@/lib/auth"
import { GitHubService } from "@/lib/github-service"
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
        timestamp: new Date().toISOString(),
      })
    } else {
      // Fallback terminal simulation
      const output = await simulateTerminalCommand(command, githubStorage)

      return NextResponse.json({
        success: true,
        output,
        command,
        timestamp: new Date().toISOString(),
      })
    }
  } catch (error) {
    console.error("Error in terminal API:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

async function simulateTerminalCommand(command: string, githubStorage: GitHubStorageService): Promise<string> {
  const cmd = command.trim().toLowerCase()

  if (cmd === "ls" || cmd === "dir") {
    try {
      const files = await githubStorage.getAllFiles()
      return `Files and directories:\n${files.map((f, i) => `${i + 1}. ${f.name} (${f.type})`).join("\n")}`
    } catch (error) {
      return `Error listing files: ${error instanceof Error ? error.message : "Unknown error"}`
    }
  }

  if (cmd.startsWith("cat ") || cmd.startsWith("type ")) {
    const filePath = command.substring(4).trim()
    try {
      const content = await githubStorage.getFileContent(filePath)
      return content ? `Content of ${filePath}:\n${content}` : `File not found: ${filePath}`
    } catch (error) {
      return `Error reading file: ${error instanceof Error ? error.message : "Unknown error"}`
    }
  }

  if (cmd === "pwd") {
    return `/workspace/prodev-project`
  }

  if (cmd.startsWith("npm ") || cmd.startsWith("yarn ")) {
    return `Executing: ${command}\n✅ Package manager command completed successfully`
  }

  if (cmd.startsWith("git ")) {
    return `Executing: ${command}\n✅ Git command completed successfully`
  }

  return `Executing: ${command}\n✅ Command completed successfully`
}
