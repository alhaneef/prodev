import bcrypt from "bcryptjs"
import { db } from "./database"
import type { NextRequest } from "next/server"

export interface AuthUser {
  id: number
  email: string
}

export class AuthService {
  async signUp(email: string, password: string): Promise<{ user: AuthUser }> {
    try {
      // Check if user already exists
      const existingUser = await db.getUserByEmail(email)
      if (existingUser) {
        throw new Error("User already exists")
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12)

      // Create user
      const user = await db.createUser(email, passwordHash)

      return {
        user: { id: user.id, email: user.email },
      }
    } catch (error) {
      console.error("SignUp error:", error)
      throw error
    }
  }

  async signIn(email: string, password: string): Promise<{ user: AuthUser }> {
    try {
      // Get user
      const user = await db.getUserByEmail(email)
      if (!user) {
        throw new Error("Invalid credentials")
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.password_hash)
      if (!isValid) {
        throw new Error("Invalid credentials")
      }

      return {
        user: { id: user.id, email: user.email },
      }
    } catch (error) {
      console.error("SignIn error:", error)
      throw error
    }
  }
}

/**
 * Get user from session cookie in NextRequest
 */
export function getUserFromSession(request: NextRequest): AuthUser | null {
  try {
    const sessionCookie = request.cookies.get("user-session")?.value
    console.log("Session cookie exists:", !!sessionCookie)

    if (!sessionCookie) {
      console.log("No session cookie found")
      return null
    }

    const user = JSON.parse(sessionCookie)
    console.log("Parsed user from session:", user.email, "ID:", user.id)
    return user
  } catch (error) {
    console.error("Error parsing session cookie:", error)
    return null
  }
}

/**
 * Get user by ID or email from database
 */
export async function getUser(identifier: number | string): Promise<AuthUser | null> {
  try {
    const user = typeof identifier === "number" ? await db.getUserById(identifier) : await db.getUserByEmail(identifier)

    if (!user) return null

    return { id: user.id, email: user.email }
  } catch (error) {
    console.error("getUser error:", error)
    return null
  }
}

/**
 * Get authenticated user from request (combines session parsing and DB verification)
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<AuthUser | null> {
  try {
    const sessionUser = getUserFromSession(request)
    if (!sessionUser) {
      return null
    }

    // Verify user still exists in database
    const dbUser = await db.getUserById(sessionUser.id)
    if (!dbUser) {
      console.log("User not found in database:", sessionUser.id)
      return null
    }

    return { id: dbUser.id, email: dbUser.email }
  } catch (error) {
    console.error("getAuthenticatedUser error:", error)
    return null
  }
}

export const authService = new AuthService()
