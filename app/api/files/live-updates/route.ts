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
    const since = searchParams.get("since")

    if (!projectId) {
      return NextResponse.json({ success: false, error: "Project ID required" })
    }

    // Verify project ownership
    const project = await db.getProject(projectId)
    if (!project || project.user_id !== user.id) {
      return NextResponse.json({ success: false, error: "Project not found" })
    }

    const sinceDate = since ? new Date(Number.parseInt(since)) : new Date(Date.now() - 60000) // Last minute

    const result = await db.query(
      `SELECT update_data, created_at 
       FROM live_updates 
       WHERE project_id = $1 AND created_at > $2 
       ORDER BY created_at ASC`,
      [projectId, sinceDate],
    )

    const updates = result.rows.map((row) => ({
      ...JSON.parse(row.update_data),
      timestamp: row.created_at,
    }))

    return NextResponse.json({
      success: true,
      updates,
    })
  } catch (error) {
    console.error("Live updates API error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get live updates",
    })
  }
}
