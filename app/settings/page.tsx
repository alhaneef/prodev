"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  User,
  Bell,
  Shield,
  Database,
  Trash2,
  Download,
  Upload,
  SettingsIcon,
  AlertTriangle,
  Save,
  Loader2,
} from "lucide-react"
import { CredentialsSetup } from "@/components/credentials-setup"
import { useAuth } from "@/components/auth-provider"

export default function SettingsPage() {
  const { user, loading, refreshAuth } = useAuth()
  const [pageLoading, setPageLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    timezone: "UTC",
    language: "en",
  })
  const [notifications, setNotifications] = useState({
    email_notifications: true,
    push_notifications: false,
    task_updates: true,
    deployment_alerts: true,
    weekly_reports: false,
  })
  const [preferences, setPreferences] = useState({
    theme: "light",
    auto_save: true,
    code_completion: true,
    autonomous_mode: true,
    auto_approve: false,
    code_quality: "production",
  })

  console.log("🔍 Settings Page - User:", user?.email || "None", "Loading:", loading)

  useEffect(() => {
    if (user && !loading) {
      console.log("✅ User authenticated, loading settings for:", user.email)
      loadSettings()
    }
  }, [user, loading])

  const loadSettings = async () => {
    try {
      console.log("📥 Loading settings...")
      const response = await fetch("/api/settings", {
        credentials: "include",
        cache: "no-cache",
      })

      console.log("📥 Settings response status:", response.status)
      const data = await response.json()
      console.log("📥 Settings data:", data)

      if (data.success) {
        if (data.profile) {
          setProfile({
            name: data.profile.name || user?.email?.split("@")[0] || "",
            email: data.profile.email || user?.email || "",
            timezone: data.profile.timezone || "UTC",
            language: data.profile.language || "en",
          })
        }

        if (data.settings) {
          setNotifications({
            email_notifications: data.settings.email_notifications ?? true,
            push_notifications: data.settings.push_notifications ?? false,
            task_updates: data.settings.task_updates ?? true,
            deployment_alerts: data.settings.deployment_alerts ?? true,
            weekly_reports: data.settings.weekly_reports ?? false,
          })

          setPreferences({
            theme: data.settings.theme || "light",
            auto_save: data.settings.auto_save ?? true,
            code_completion: data.settings.code_completion ?? true,
            autonomous_mode: data.settings.autonomous_mode ?? true,
            auto_approve: data.settings.auto_approve ?? false,
            code_quality: data.settings.code_quality || "production",
          })
        }
        console.log("✅ Settings loaded successfully")
      } else if (response.status === 401) {
        console.log("🔄 Unauthorized, refreshing auth...")
        await refreshAuth()
      }
    } catch (error) {
      console.error("🚨 Error loading settings:", error)
      setMessage("Error loading settings. Please refresh the page.")
    }
  }

  const handleSaveProfile = async () => {
    setPageLoading(true)
    setMessage("")

    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type: "profile", data: profile }),
      })

      const data = await response.json()

      if (data.success) {
        setMessage("Profile updated successfully!")
        setTimeout(() => setMessage(""), 3000)
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      setMessage("Error updating profile: " + (error instanceof Error ? error.message : "Unknown error"))
    } finally {
      setPageLoading(false)
    }
  }

  const handleSaveNotifications = async () => {
    setPageLoading(true)
    setMessage("")

    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type: "notifications", data: notifications }),
      })

      const data = await response.json()

      if (data.success) {
        setMessage("Notification preferences saved!")
        setTimeout(() => setMessage(""), 3000)
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      setMessage("Error saving preferences: " + (error instanceof Error ? error.message : "Unknown error"))
    } finally {
      setPageLoading(false)
    }
  }

  const handleSavePreferences = async () => {
    setPageLoading(true)
    setMessage("")

    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type: "preferences", data: preferences }),
      })

      const data = await response.json()

      if (data.success) {
        setMessage("Preferences saved successfully!")
        setTimeout(() => setMessage(""), 3000)
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      setMessage("Error saving preferences: " + (error instanceof Error ? error.message : "Unknown error"))
    } finally {
      setPageLoading(false)
    }
  }

  const handleExportData = async () => {
    setPageLoading(true)
    try {
      const response = await fetch("/api/export-data", {
        method: "GET",
        credentials: "include",
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.style.display = "none"
        a.href = url
        a.download = `prodev-export-${Date.now()}.json`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)

        setMessage("Data export completed! Check your downloads.")
        setTimeout(() => setMessage(""), 3000)
      } else {
        throw new Error("Export failed")
      }
    } catch (error) {
      setMessage("Error exporting data: " + (error instanceof Error ? error.message : "Unknown error"))
    } finally {
      setPageLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
      setPageLoading(true)
      try {
        const response = await fetch("/api/user", {
          method: "DELETE",
          credentials: "include",
        })

        if (response.ok) {
          window.location.href = "/"
        } else {
          throw new Error("Failed to delete account")
        }
      } catch (error) {
        setMessage("Error deleting account: " + (error instanceof Error ? error.message : "Unknown error"))
        setPageLoading(false)
      }
    }
  }

  // Show loading state while auth is being checked
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading...</span>
        </div>
      </div>
    )
  }

  // Show login prompt if not authenticated
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Authentication Required</h2>
          <p className="text-slate-600 mb-6">Please log in to access your settings.</p>
          <Button onClick={() => (window.location.href = "/")}>Go to Login</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Settings</h1>
        <p className="text-slate-600">Manage your account settings and preferences - Welcome, {user.email}!</p>
      </div>

      {message && (
        <Alert
          className={message.includes("Error") ? "border-red-200 bg-red-50 mb-6" : "border-green-200 bg-green-50 mb-6"}
        >
          <AlertDescription className={message.includes("Error") ? "text-red-700" : "text-green-700"}>
            {message}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="credentials" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="credentials">API Keys</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
        </TabsList>

        <TabsContent value="credentials">
          <CredentialsSetup />
        </TabsContent>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
              <CardDescription>Update your personal information and account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Display Name</Label>
                  <Input
                    id="name"
                    value={profile.name}
                    onChange={(e) => setProfile((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Your display name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="your@email.com"
                    disabled
                  />
                  <p className="text-xs text-slate-500">Email cannot be changed</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input
                    id="timezone"
                    value={profile.timezone}
                    onChange={(e) => setProfile((prev) => ({ ...prev, timezone: e.target.value }))}
                    placeholder="UTC"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Input
                    id="language"
                    value={profile.language}
                    onChange={(e) => setProfile((prev) => ({ ...prev, language: e.target.value }))}
                    placeholder="en"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveProfile} disabled={pageLoading}>
                  {pageLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Profile
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
              <CardDescription>Choose how you want to be notified about updates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="email-notifications">Email Notifications</Label>
                    <p className="text-sm text-slate-500">Receive notifications via email</p>
                  </div>
                  <Switch
                    id="email-notifications"
                    checked={notifications.email_notifications}
                    onCheckedChange={(checked) =>
                      setNotifications((prev) => ({ ...prev, email_notifications: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="push-notifications">Push Notifications</Label>
                    <p className="text-sm text-slate-500">Receive browser push notifications</p>
                  </div>
                  <Switch
                    id="push-notifications"
                    checked={notifications.push_notifications}
                    onCheckedChange={(checked) =>
                      setNotifications((prev) => ({ ...prev, push_notifications: checked }))
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="task-updates">Task Updates</Label>
                    <p className="text-sm text-slate-500">Get notified when tasks are completed</p>
                  </div>
                  <Switch
                    id="task-updates"
                    checked={notifications.task_updates}
                    onCheckedChange={(checked) => setNotifications((prev) => ({ ...prev, task_updates: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="deployment-alerts">Deployment Alerts</Label>
                    <p className="text-sm text-slate-500">Notifications for deployment status</p>
                  </div>
                  <Switch
                    id="deployment-alerts"
                    checked={notifications.deployment_alerts}
                    onCheckedChange={(checked) => setNotifications((prev) => ({ ...prev, deployment_alerts: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="weekly-reports">Weekly Reports</Label>
                    <p className="text-sm text-slate-500">Receive weekly progress summaries</p>
                  </div>
                  <Switch
                    id="weekly-reports"
                    checked={notifications.weekly_reports}
                    onCheckedChange={(checked) => setNotifications((prev) => ({ ...prev, weekly_reports: checked }))}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveNotifications} disabled={pageLoading}>
                  {pageLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Preferences
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5" />
                Application Preferences
              </CardTitle>
              <CardDescription>Customize your development experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="auto-save">Auto Save</Label>
                    <p className="text-sm text-slate-500">Automatically save your work</p>
                  </div>
                  <Switch
                    id="auto-save"
                    checked={preferences.auto_save}
                    onCheckedChange={(checked) => setPreferences((prev) => ({ ...prev, auto_save: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="code-completion">Code Completion</Label>
                    <p className="text-sm text-slate-500">Enable AI-powered code suggestions</p>
                  </div>
                  <Switch
                    id="code-completion"
                    checked={preferences.code_completion}
                    onCheckedChange={(checked) => setPreferences((prev) => ({ ...prev, code_completion: checked }))}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="autonomous-mode">Autonomous Mode</Label>
                    <p className="text-sm text-slate-500">Let AI agents work independently</p>
                  </div>
                  <Switch
                    id="autonomous-mode"
                    checked={preferences.autonomous_mode}
                    onCheckedChange={(checked) => setPreferences((prev) => ({ ...prev, autonomous_mode: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="auto-approve">Auto Approve</Label>
                    <p className="text-sm text-slate-500">Automatically approve AI-generated code</p>
                  </div>
                  <Switch
                    id="auto-approve"
                    checked={preferences.auto_approve}
                    onCheckedChange={(checked) => setPreferences((prev) => ({ ...prev, auto_approve: checked }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Code Quality Level</Label>
                  <div className="flex gap-2">
                    {["development", "staging", "production"].map((level) => (
                      <Button
                        key={level}
                        variant={preferences.code_quality === level ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPreferences((prev) => ({ ...prev, code_quality: level }))}
                      >
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSavePreferences} disabled={pageLoading}>
                  {pageLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Preferences
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Settings
              </CardTitle>
              <CardDescription>Manage your account security and access</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label>Password</Label>
                  <p className="text-sm text-slate-500 mb-2">Last changed recently</p>
                  <Button variant="outline" disabled>
                    Change Password (Coming Soon)
                  </Button>
                </div>

                <Separator />

                <div>
                  <Label>Two-Factor Authentication</Label>
                  <p className="text-sm text-slate-500 mb-2">Add an extra layer of security</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                      Not Enabled
                    </Badge>
                    <Button variant="outline" size="sm" disabled>
                      Enable 2FA (Coming Soon)
                    </Button>
                  </div>
                </div>

                <Separator />

                <div>
                  <Label>Active Sessions</Label>
                  <p className="text-sm text-slate-500 mb-2">Manage your active login sessions</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="text-sm font-medium">Current Session</p>
                        <p className="text-xs text-slate-500">Browser • Current</p>
                      </div>
                      <Badge variant="secondary" className="bg-green-100 text-green-700">
                        Active
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Data Management
              </CardTitle>
              <CardDescription>Export, import, or delete your data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label>Export Data</Label>
                  <p className="text-sm text-slate-500 mb-2">Download all your projects, tasks, and settings</p>
                  <Button variant="outline" onClick={handleExportData} disabled={pageLoading}>
                    {pageLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Export Data
                      </>
                    )}
                  </Button>
                </div>

                <Separator />

                <div>
                  <Label>Import Data</Label>
                  <p className="text-sm text-slate-500 mb-2">Import projects and settings from a backup</p>
                  <Button variant="outline" disabled>
                    <Upload className="mr-2 h-4 w-4" />
                    Import Data (Coming Soon)
                  </Button>
                </div>

                <Separator />

                <div>
                  <Label className="text-red-700">Danger Zone</Label>
                  <p className="text-sm text-slate-500 mb-2">Permanently delete your account and all data</p>
                  <Alert className="border-red-200 bg-red-50 mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-red-700">
                      This action cannot be undone. All your projects, tasks, and data will be permanently deleted.
                    </AlertDescription>
                  </Alert>
                  <Button variant="destructive" onClick={handleDeleteAccount} disabled={pageLoading}>
                    {pageLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Account
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
