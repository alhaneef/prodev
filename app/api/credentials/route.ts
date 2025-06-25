import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { getUserFromSession } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    console.log("Credentials API GET - Starting request")

    const user = getUserFromSession(request)
    if (!user) {
      console.log("Credentials API GET - No user in session")
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    console.log("Credentials API GET - Fetching for user:", user.id, user.email)
    const credentials = await db.getCredentials(user.id)

    if (!credentials) {
      console.log("Credentials API GET - No credentials found, returning empty object")
      return NextResponse.json({
        success: true,
        credentials: {},
      })
    }

    console.log("Credentials API GET - Found credentials with keys:", Object.keys(credentials))

    // Don't send the actual tokens in the response for security
    const safeCredentials = {
      github_token: credentials.github_token ? "***configured***" : "",
      github_username: credentials.github_username || "",
      vercel_token: credentials.vercel_token ? "***configured***" : "",
      netlify_token: credentials.netlify_token ? "***configured***" : "",
      cloudflare_token: credentials.cloudflare_token ? "***configured***" : "",
      cloudflare_account_id: credentials.cloudflare_account_id || "",
      gemini_api_key: credentials.gemini_api_key ? "***configured***" : "",
    }

    return NextResponse.json({
      success: true,
      credentials: safeCredentials,
    })
  } catch (error) {
    console.error("Credentials API GET error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch credentials",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("Credentials API POST - Starting request")

    const user = getUserFromSession(request)
    if (!user) {
      console.log("Credentials API POST - No user in session")
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    console.log("Credentials API POST - Saving for user:", user.id, "Keys:", Object.keys(body))

    // Only save non-empty values and don't overwrite with placeholder values
    const credentialsToSave: any = {}

    Object.keys(body).forEach((key) => {
      const value = body[key]
      if (value && value !== "***configured***" && value.trim() !== "") {
        credentialsToSave[key] = value.trim()
      }
    })

    if (Object.keys(credentialsToSave).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No valid credentials provided",
        },
        { status: 400 },
      )
    }

    await db.saveCredentials(user.id, credentialsToSave)
    console.log("Credentials API POST - Saved successfully")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Credentials API POST error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to save credentials",
      },
      { status: 500 },
    )
  }
}
