import type { NextRequest } from "next/server"
import { db } from "./database"
import bcrypt from "bcryptjs"

export interface SessionUser {
  id: number
  email: string
  name?: string
}

export class AuthService {
  async signUp(email: string, password: string) {
    const existing = await db.getUserByEmail(email)
    if (existing) throw new Error("User already exists")

    const hash = await bcrypt.hash(password, 12)
    const user = await db.createUser(email, hash)

    return { user: { id: user.id, email: user.email } }
  }

  async signIn(email: string, password: string) {
    const user = await db.getUserByEmail(email)
    if (!user) throw new Error("Invalid credentials")

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) throw new Error("Invalid credentials")

    return { user: { id: user.id, email: user.email } }
  }
}

export function getUserFromSession(request: NextRequest): SessionUser | null {
  try {
    const sessionCookie = request.cookies.get("user-session")?.value
    if (!sessionCookie) {
      console.log("No user-session cookie found")
      return null
    }

    const user = JSON.parse(sessionCookie)
    console.log("Retrieved user from session:", { id: user.id, email: user.email })
    return user
  } catch (error) {
    console.error("Error parsing user session:", error)
    return null
  }
}

export async function getUserCredentials(userId: number) {
  try {
    console.log("Fetching credentials for user ID:", userId)
    const credentials = await db.getCredentials(userId)

    if (!credentials) {
      console.log("No credentials found for user:", userId)
      return null
    }

    console.log("Found credentials for user:", userId, "Keys:", Object.keys(credentials))
    return credentials
  } catch (error) {
    console.error("Error fetching user credentials:", error)
    return null
  }
}

export async function requireGitHubToken(request: NextRequest) {
  const user = getUserFromSession(request)
  if (!user) {
    throw new Error("User not authenticated")
  }

  const credentials = await getUserCredentials(user.id)
  if (!credentials?.github_token) {
    throw new Error("GitHub token not configured")
  }

  return {
    user,
    credentials,
    githubToken: credentials.github_token,
  }
}

export const authService = new AuthService()
