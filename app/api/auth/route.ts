import { type NextRequest, NextResponse } from "next/server"
import { authService } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const { action, email, password } = await request.json()

    if (action === "signin") {
      const { user } = await authService.signIn(email, password)

      // Create session cookie with 30 days expiration
      const response = NextResponse.json({ success: true, user })
      response.cookies.set("user-session", JSON.stringify(user), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: "/",
      })

      console.log("User signed in successfully:", user.email)
      return response
    }

    if (action === "signup") {
      const { user } = await authService.signUp(email, password)

      // Create session cookie with 30 days expiration
      const response = NextResponse.json({ success: true, user })
      response.cookies.set("user-session", JSON.stringify(user), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: "/",
      })

      console.log("User signed up successfully:", user.email)
      return response
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Auth error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Authentication failed" },
      { status: 400 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const response = NextResponse.json({ success: true })
    response.cookies.delete("user-session")
    console.log("User signed out successfully")
    return response
  } catch (error) {
    console.error("Sign out error:", error)
    return NextResponse.json({ success: false, error: "Sign out failed" }, { status: 500 })
  }
}
