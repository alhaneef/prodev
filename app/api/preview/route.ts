import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"

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
      return NextResponse.json({ success: false, error: "Project ID required" })
    }

    // Get project and verify ownership
    const project = await db.getProject(projectId)
    if (!project || project.user_id !== user.id) {
      return NextResponse.json({ success: false, error: "Project not found" })
    }

    // For now, we'll use GitHub Pages or raw GitHub content for preview
    // In a full implementation, you might want to use services like CodeSandbox API
    const [owner, repo] = project.repository.split("/").slice(-2)

    // Try different preview strategies based on framework
    let previewUrl = ""

    switch (project.framework.toLowerCase()) {
      case "react":
      case "next.js":
      case "vue.js":
      case "svelte":
        // Use GitHub Pages if available, otherwise suggest deployment
        previewUrl = `https://${owner}.github.io/${repo}`
        break
      default:
        // For static sites, try GitHub raw content
        previewUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/index.html`
    }

    return NextResponse.json({
      success: true,
      previewUrl,
      message: "Preview URL generated. Note: For full functionality, deploy your project.",
    })
  } catch (error) {
    console.error("Preview API error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate preview",
    })
  }
}
