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

    const settings = await db.getUserSettings(user.id)
    const userProfile = await db.getUserById(user.id)

    return NextResponse.json({
      success: true,
      settings: settings || {},
      profile: {
        name: userProfile?.name || "",
        email: userProfile?.email || "",
        timezone: userProfile?.timezone || "UTC",
        language: userProfile?.language || "en",
      },
    })
  } catch (error) {
    console.error("Error fetching settings:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch settings" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromSession(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { type, data } = body

    if (type === "profile") {
      await db.updateUser(user.id, {
        name: data.name,
        timezone: data.timezone,
        language: data.language,
      })
    } else if (type === "notifications" || type === "preferences") {
      await db.saveUserSettings(user.id, data)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error saving settings:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to save settings",
      },
      { status: 500 },
    )
  }
}
