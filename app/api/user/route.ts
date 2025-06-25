import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { getUserFromSession } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromSession(request)

    if (!user) {
      console.log("No user found in session")
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 })
    }

    // Verify user still exists in database
    const dbUser = await db.getUserById(user.id)
    if (!dbUser) {
      console.log("User not found in database:", user.id)
      return NextResponse.json({ success: false, error: "User not found" }, { status: 401 })
    }

    console.log("User authenticated successfully:", user.email)
    return NextResponse.json({
      success: true,
      user: { id: dbUser.id, email: dbUser.email },
    })
  } catch (error) {
    console.error("User route error:", error)
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = getUserFromSession(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const updates = await request.json()
    await db.updateUser(user.id, updates)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating user:", error)
    return NextResponse.json({ success: false, error: "Failed to update user" }, { status: 500 })
  }
}
