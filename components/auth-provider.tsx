"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"

interface User {
  id: number
  email: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    initializeAuth()
  }, [])

  const initializeAuth = async () => {
    console.log("🔄 Initializing authentication...")

    // First, immediately check localStorage to set initial state
    const storedUser = localStorage.getItem("prodev-user")
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser)
        console.log("✅ Found stored user, setting immediately:", userData.email)
        setUser(userData)
        setLoading(false) // Set loading to false immediately when we have stored user
      } catch (e) {
        console.log("❌ Invalid stored user data, removing...")
        localStorage.removeItem("prodev-user")
      }
    }

    // Then verify with server in the background
    try {
      const response = await fetch("/api/user", {
        method: "GET",
        credentials: "include",
        cache: "no-cache",
      })

      console.log("🌐 Server auth check response:", response.status)

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.user) {
          console.log("✅ Server confirmed user:", data.user.email)
          setUser(data.user)
          localStorage.setItem("prodev-user", JSON.stringify(data.user))
        } else {
          console.log("❌ Server returned no user")
          setUser(null)
          localStorage.removeItem("prodev-user")
        }
      } else {
        console.log("❌ Server auth failed, status:", response.status)
        // Only clear user if we don't have stored data
        if (!storedUser) {
          setUser(null)
        }
      }
    } catch (error) {
      console.error("🚨 Auth check network error:", error)
      // Keep stored user on network error
      if (!storedUser) {
        setUser(null)
      }
    } finally {
      setLoading(false)
    }
  }

  const refreshAuth = async () => {
    console.log("🔄 Refreshing authentication...")
    setLoading(true)
    await initializeAuth()
  }

  const signIn = async (email: string, password: string) => {
    console.log("🔐 Signing in user:", email)

    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "signin", email, password }),
    })

    const data = await response.json()
    console.log("📝 Sign in response:", data)

    if (!data.success) {
      throw new Error(data.error)
    }

    console.log("✅ Sign in successful, setting user:", data.user)
    setUser(data.user)
    localStorage.setItem("prodev-user", JSON.stringify(data.user))
  }

  const signUp = async (email: string, password: string) => {
    console.log("📝 Signing up user:", email)

    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "signup", email, password }),
    })

    const data = await response.json()
    console.log("📝 Sign up response:", data)

    if (!data.success) {
      throw new Error(data.error)
    }

    console.log("✅ Sign up successful, setting user:", data.user)
    setUser(data.user)
    localStorage.setItem("prodev-user", JSON.stringify(data.user))
  }

  const signOut = async () => {
    console.log("🚪 Signing out user")

    try {
      await fetch("/api/auth", {
        method: "DELETE",
        credentials: "include",
      })
    } catch (error) {
      console.error("🚨 Sign out error:", error)
    } finally {
      setUser(null)
      localStorage.removeItem("prodev-user")
      console.log("✅ User signed out, cleared state")
    }
  }

  console.log("🔍 Auth Provider State - User:", user?.email || "None", "Loading:", loading)

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
