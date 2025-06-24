"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Github, Key, Cloud, Zap, CheckCircle, AlertCircle, Loader2, RefreshCw } from "lucide-react"
import { useAuth } from "./auth-provider"

export function CredentialsSetup() {
  const { user, refreshAuth } = useAuth()
  const [credentials, setCredentials] = useState({
    github_token: "",
    github_username: "",
    vercel_token: "",
    netlify_token: "",
    cloudflare_token: "",
    cloudflare_account_id: "",
    gemini_api_key: "",
  })
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState<string>("")
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (user) {
      console.log("User available, loading credentials for:", user.email)
      loadCredentials()
    } else {
      console.log("No user available for credentials")
    }
  }, [user])

  const loadCredentials = async () => {
    try {
      console.log("Loading credentials...")

      const response = await fetch("/api/credentials", {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      })

      console.log("Load credentials response:", response.status)

      if (response.status === 401) {
        console.log("Unauthorized, refreshing auth...")
        await refreshAuth()
        setMessage("Session expired. Please refresh the page if the issue persists.")
        return
      }

      const data = await response.json()
      console.log("Credentials data:", data)

      if (data.success && data.credentials) {
        setCredentials({
          github_token: data.credentials.github_token || "",
          github_username: data.credentials.github_username || "",
          vercel_token: data.credentials.vercel_token || "",
          netlify_token: data.credentials.netlify_token || "",
          cloudflare_token: data.credentials.cloudflare_token || "",
          cloudflare_account_id: data.credentials.cloudflare_account_id || "",
          gemini_api_key: data.credentials.gemini_api_key || "",
        })
        console.log("Credentials loaded successfully")
      }
    } catch (error) {
      console.error("Error loading credentials:", error)
      setMessage("Error loading credentials. Please refresh the page.")
    }
  }

  const handleSave = async () => {
    if (!user) {
      setMessage("Please log in to save credentials.")
      return
    }

    setLoading(true)
    setMessage("")

    try {
      console.log("Saving credentials for user:", user.email)

      const response = await fetch("/api/credentials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(credentials),
      })

      console.log("Save credentials response:", response.status)

      if (response.status === 401) {
        console.log("Unauthorized during save, refreshing auth...")
        await refreshAuth()
        setMessage("Session expired. Please try saving again.")
        return
      }

      const data = await response.json()
      console.log("Save response data:", data)

      if (data.success) {
        setMessage("Credentials saved successfully!")
        setTimeout(() => setMessage(""), 3000)
      } else {
        throw new Error(data.error || "Failed to save credentials")
      }
    } catch (error) {
      console.error("Save credentials error:", error)
      setMessage("Error saving credentials: " + (error instanceof Error ? error.message : "Unknown error"))
    } finally {
      setLoading(false)
    }
  }

  const testCredential = async (service: string) => {
    setTesting(service)
    setMessage("")

    try {
      switch (service) {
        case "github":
          if (credentials.github_token) {
            const response = await fetch("https://api.github.com/user", {
              headers: { Authorization: `token ${credentials.github_token}` },
            })
            if (response.ok) {
              const userData = await response.json()
              setCredentials((prev) => ({ ...prev, github_username: userData.login }))
              setMessage("GitHub credentials verified successfully!")
            } else {
              throw new Error("Invalid GitHub token")
            }
          }
          break
        case "gemini":
          if (credentials.gemini_api_key) {
            if (credentials.gemini_api_key.startsWith("AIza")) {
              setMessage("Gemini API key format is valid!")
            } else {
              throw new Error("Invalid Gemini API key format")
            }
          }
          break
        default:
          setMessage(`${service} credentials saved!`)
      }
    } catch (error) {
      setMessage(`Error testing ${service}: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setTesting("")
    }
  }

  if (!user) {
    return (
      <div className="text-center py-8">
        <p className="text-slate-600">Please log in to configure your credentials.</p>
        <Button onClick={refreshAuth} className="mt-4">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh Session
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">Setup Credentials</h2>
        <p className="text-slate-600">Configure your API keys and tokens to enable all platform features</p>
        <p className="text-sm text-slate-500 mt-1">Logged in as: {user.email}</p>
      </div>

      {message && (
        <Alert className={message.includes("Error") ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className={message.includes("Error") ? "text-red-700" : "text-green-700"}>
            {message}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6">
        {/* GitHub - Required */}
        <Card className="border-blue-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Github className="h-5 w-5" />
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    GitHub
                    <Badge variant="destructive" className="text-xs">
                      Required
                    </Badge>
                  </CardTitle>
                  <CardDescription>Personal access token for repository management</CardDescription>
                </div>
              </div>
              <Badge variant={credentials.github_token ? "default" : "secondary"}>
                {credentials.github_token ? "Connected" : "Not Connected"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                value={credentials.github_token}
                onChange={(e) => setCredentials((prev) => ({ ...prev, github_token: e.target.value }))}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={() => testCredential("github")}
                disabled={!credentials.github_token || testing === "github"}
              >
                {testing === "github" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Create a token at GitHub Settings → Developer settings → Personal access tokens (with repo permissions)
            </p>
          </CardContent>
        </Card>

        {/* Gemini AI - Required */}
        <Card className="border-purple-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5" />
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    Google Gemini
                    <Badge variant="destructive" className="text-xs">
                      Required
                    </Badge>
                  </CardTitle>
                  <CardDescription>API key for AI-powered development agents</CardDescription>
                </div>
              </div>
              <Badge variant={credentials.gemini_api_key ? "default" : "secondary"}>
                {credentials.gemini_api_key ? "Connected" : "Not Connected"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="AIzaxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={credentials.gemini_api_key}
                onChange={(e) => setCredentials((prev) => ({ ...prev, gemini_api_key: e.target.value }))}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={() => testCredential("gemini")}
                disabled={!credentials.gemini_api_key || testing === "gemini"}
              >
                {testing === "gemini" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-slate-500">Get your API key from Google AI Studio (aistudio.google.com)</p>
          </CardContent>
        </Card>

        {/* Deployment Platforms - Optional */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900">Deployment Platforms (Optional)</h3>

          {/* Vercel */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Cloud className="h-5 w-5" />
                  <div>
                    <CardTitle className="text-base">Vercel</CardTitle>
                    <CardDescription>Deploy your applications to Vercel</CardDescription>
                  </div>
                </div>
                <Badge variant={credentials.vercel_token ? "default" : "secondary"}>
                  {credentials.vercel_token ? "Connected" : "Not Connected"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="Vercel API Token"
                  value={credentials.vercel_token}
                  onChange={(e) => setCredentials((prev) => ({ ...prev, vercel_token: e.target.value }))}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={() => testCredential("vercel")}
                  disabled={!credentials.vercel_token || testing === "vercel"}
                >
                  {testing === "vercel" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Netlify */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Cloud className="h-5 w-5" />
                  <div>
                    <CardTitle className="text-base">Netlify</CardTitle>
                    <CardDescription>Deploy to Netlify</CardDescription>
                  </div>
                </div>
                <Badge variant={credentials.netlify_token ? "default" : "secondary"}>
                  {credentials.netlify_token ? "Connected" : "Not Connected"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="Netlify API Token"
                  value={credentials.netlify_token}
                  onChange={(e) => setCredentials((prev) => ({ ...prev, netlify_token: e.target.value }))}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={() => testCredential("netlify")}
                  disabled={!credentials.netlify_token || testing === "netlify"}
                >
                  {testing === "netlify" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Cloudflare */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Cloud className="h-5 w-5" />
                  <div>
                    <CardTitle className="text-base">Cloudflare</CardTitle>
                    <CardDescription>Deploy to Cloudflare Pages</CardDescription>
                  </div>
                </div>
                <Badge variant={credentials.cloudflare_token ? "default" : "secondary"}>
                  {credentials.cloudflare_token ? "Connected" : "Not Connected"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="Cloudflare API Token"
                  value={credentials.cloudflare_token}
                  onChange={(e) => setCredentials((prev) => ({ ...prev, cloudflare_token: e.target.value }))}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={() => testCredential("cloudflare")}
                  disabled={!credentials.cloudflare_token || testing === "cloudflare"}
                >
                  {testing === "cloudflare" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="mt-2">
                <Input
                  placeholder="Account ID (optional)"
                  value={credentials.cloudflare_account_id}
                  onChange={(e) => setCredentials((prev) => ({ ...prev, cloudflare_account_id: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Key className="mr-2 h-4 w-4" />
              Save Credentials
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
