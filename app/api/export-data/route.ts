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

    // Fetch all user data
    const [userProfile, credentials, settings, projects] = await Promise.all([
      db.getUserById(user.id),
      db.getCredentials(user.id),
      db.getUserSettings(user.id),
      db.getUserProjects(user.id),
    ])

    // Get tasks for all projects
    const allTasks = []
    for (const project of projects) {
      const tasks = await db.getProjectTasks(project.id)
      allTasks.push(...tasks)
    }

    const exportData = {
      user: {
        email: userProfile?.email,
        name: userProfile?.name,
        timezone: userProfile?.timezone,
        language: userProfile?.language,
        created_at: userProfile?.created_at,
      },
      settings: settings || {},
      credentials: credentials
        ? {
            github_username: credentials.github_username,
            // Don't export actual tokens for security
            has_github_token: !!credentials.github_token,
            has_vercel_token: !!credentials.vercel_token,
            has_netlify_token: !!credentials.netlify_token,
            has_cloudflare_token: !!credentials.cloudflare_token,
            has_gemini_api_key: !!credentials.gemini_api_key,
          }
        : {},
      projects: projects.map((p) => ({
        ...p,
        // Remove sensitive data
        user_id: undefined,
      })),
      tasks: allTasks.map((t) => ({
        ...t,
        // Keep all task data as it's not sensitive
      })),
      exported_at: new Date().toISOString(),
    }

    const response = new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="prodev-export-${Date.now()}.json"`,
      },
    })

    return response
  } catch (error) {
    console.error("Error exporting data:", error)
    return NextResponse.json({ success: false, error: "Failed to export data" }, { status: 500 })
  }
}
