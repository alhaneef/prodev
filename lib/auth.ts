import bcrypt from "bcryptjs"
import { db } from "./database"

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

export const authService = new AuthService()
