import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"

function getUserFromSession(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("user-session")?.value
    console.log("Credentials API - Session cookie exists:", !!sessionCookie)

    if (!sessionCookie) {
      console.log("Credentials API - No session cookie found")
      return null
    }

    const user = JSON.parse(sessionCookie)
    console.log("Credentials API - Parsed user:", user.email, "ID:", user.id)
    return user
  } catch (error) {
    console.error("Credentials API - Error parsing session:", error)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromSession(request)

    if (!user) {
      console.log("Credentials GET - No user in session")
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    console.log("Credentials GET - Fetching for user:", user.id)
    const credentials = await db.getCredentials(user.id)

    return NextResponse.json({
      success: true,
      credentials: credentials || {},
    })
  } catch (error) {
    console.error("Error fetching credentials:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch credentials" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromSession(request)

    if (!user) {
      console.log("Credentials POST - No user in session")
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    console.log("Credentials POST - Saving for user:", user.id, "Keys:", Object.keys(body))

    await db.saveCredentials(user.id, body)
    console.log("Credentials POST - Saved successfully")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error saving credentials:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to save credentials",
      },
      { status: 500 },
    )
  }
}
