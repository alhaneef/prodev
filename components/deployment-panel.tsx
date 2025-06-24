"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Rocket,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  Settings,
  History,
  Zap,
  Globe,
  Server,
  Cloud,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface DeploymentPanelProps {
  projectId: string
  project: any
}

interface DeploymentLog {
  id: string
  timestamp: string
  level: "info" | "warning" | "error" | "success"
  message: string
  details?: any
}

interface DeploymentHistory {
  id: string
  platform: string
  status: "success" | "failed" | "pending"
  url?: string
  timestamp: string
  buildTime?: string
  error?: string
}

export function DeploymentPanel({ projectId, project }: DeploymentPanelProps) {
  const [isDeploying, setIsDeploying] = useState(false)
  const [deploymentPlatform, setDeploymentPlatform] = useState<"vercel" | "netlify" | "cloudflare">("vercel")
  const [deploymentLogs, setDeploymentLogs] = useState<DeploymentLog[]>([])
  const [deploymentHistory, setDeploymentHistory] = useState<DeploymentHistory[]>([])
  const [deploymentProgress, setDeploymentProgress] = useState(0)
  const [deploymentUrl, setDeploymentUrl] = useState(project?.deployment_url || "")
  const [previewUrl, setPreviewUrl] = useState("")
  const [lastDeployment, setLastDeployment] = useState<any>(null)
  const [autoFixEnabled, setAutoFixEnabled] = useState(true)
  const logsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadDeploymentHistory()
    loadDeploymentLogs()
  }, [projectId])

  useEffect(() => {
    // Auto-scroll logs
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight
    }
  }, [deploymentLogs])

  const loadDeploymentHistory = async () => {
    try {
      const response = await fetch(`/api/deploy/history?projectId=${projectId}`, {
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setDeploymentHistory(data.history || [])
          setLastDeployment(data.lastDeployment)
        }
      }
    } catch (error) {
      console.error("Error loading deployment history:", error)
    }
  }

  const loadDeploymentLogs = async () => {
    try {
      const response = await fetch(`/api/deploy/logs?projectId=${projectId}`, {
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setDeploymentLogs(data.logs || [])
        }
      }
    } catch (error) {
      console.error("Error loading deployment logs:", error)
    }
  }

  const addLog = (level: DeploymentLog["level"], message: string, details?: any) => {
    const log: DeploymentLog = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      level,
      message,
      details,
    }
    setDeploymentLogs((prev) => [...prev, log])
  }

  const handleDeploy = async (platform?: string) => {
    const targetPlatform = platform || deploymentPlatform
    setIsDeploying(true)
    setDeploymentProgress(0)
    setDeploymentLogs([])

    try {
      addLog("info", `Starting deployment to ${targetPlatform}...`)
      setDeploymentProgress(10)

      addLog("info", "Preparing project files...")
      setDeploymentProgress(25)

      const response = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId,
          platform: targetPlatform,
        }),
      })

      setDeploymentProgress(50)
      addLog("info", "Uploading to deployment platform...")

      const data = await response.json()

      if (data.success) {
        setDeploymentProgress(75)
        addLog("info", "Building application...")

        // Simulate build process
        await new Promise((resolve) => setTimeout(resolve, 2000))

        setDeploymentProgress(90)
        addLog("info", "Finalizing deployment...")

        await new Promise((resolve) => setTimeout(resolve, 1000))

        setDeploymentProgress(100)
        addLog("success", `Deployment successful! 🎉`)
        addLog("success", `Live URL: ${data.deploymentUrl}`)
        addLog("success", `Preview URL: ${data.previewUrl || data.deploymentUrl}`)

        setDeploymentUrl(data.deploymentUrl)
        setPreviewUrl(data.previewUrl || data.deploymentUrl)

        // Add to history
        const newDeployment: DeploymentHistory = {
          id: `deploy_${Date.now()}`,
          platform: targetPlatform,
          status: data.status === "success" ? "success" : "failed",
          url: data.deploymentUrl,
          timestamp: new Date().toISOString(),
          buildTime: "2m 30s",
        }

        setDeploymentHistory((prev) => [newDeployment, ...prev])
        setLastDeployment(newDeployment)
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      addLog("error", `Deployment failed: ${error instanceof Error ? error.message : "Unknown error"}`)

      // Try to auto-fix deployment error with AI
      if (autoFixEnabled && error instanceof Error) {
        addLog("info", "🤖 AI Agent attempting to fix deployment error...")
        try {
          const fixResponse = await fetch("/api/deploy/fix", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              projectId,
              error: error.message,
              platform: targetPlatform,
            }),
          })

          const fixData = await fixResponse.json()
          if (fixData.success) {
            addLog("success", "🔧 AI Agent generated a fix!")
            addLog("info", fixData.solution)

            // Auto-redeploy after fix
            addLog("info", "🚀 Auto-redeploying with fixes...")
            setTimeout(() => handleDeploy(targetPlatform), 2000)
          } else {
            addLog("error", "AI Agent could not generate automatic fix")
          }
        } catch (fixError) {
          addLog("error", "Could not generate automatic fix")
        }
      }
    } finally {
      setIsDeploying(false)
    }
  }

  const handlePreview = async () => {
    try {
      const response = await fetch(`/api/preview?projectId=${projectId}`, {
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.previewUrl) {
          window.open(data.previewUrl, "_blank")
        }
      }
    } catch (error) {
      console.error("Error generating preview:", error)
    }
  }

  const handleRedeploy = (deployment: DeploymentHistory) => {
    handleDeploy(deployment.platform)
  }

  const getLogIcon = (level: DeploymentLog["level"]) => {
    switch (level) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-600" />
      case "warning":
        return <AlertCircle className="h-4 w-4 text-yellow-600" />
      default:
        return <Clock className="h-4 w-4 text-blue-600" />
    }
  }

  const getLogColor = (level: DeploymentLog["level"]) => {
    switch (level) {
      case "success":
        return "text-green-700"
      case "error":
        return "text-red-700"
      case "warning":
        return "text-yellow-700"
      default:
        return "text-slate-700"
    }
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "vercel":
        return <Globe className="h-4 w-4" />
      case "netlify":
        return <Server className="h-4 w-4" />
      case "cloudflare":
        return <Cloud className="h-4 w-4" />
      default:
        return <Rocket className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Deployment</h2>
          <p className="text-slate-600">Deploy and manage your project across platforms</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePreview}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          {deploymentUrl && (
            <Button variant="outline" asChild>
              <a href={deploymentUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Live Site
              </a>
            </Button>
          )}
          {previewUrl && previewUrl !== deploymentUrl && (
            <Button variant="outline" asChild>
              <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Deployment Status */}
      {lastDeployment && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getPlatformIcon(lastDeployment.platform)}
                <span className="font-medium">Last deployed:</span>{" "}
                {new Date(lastDeployment.timestamp).toLocaleString()} to {lastDeployment.platform}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={lastDeployment.status === "success" ? "default" : "destructive"}>
                  {lastDeployment.status}
                </Badge>
                {lastDeployment.status === "success" && (
                  <Badge variant="secondary" className="bg-green-100 text-green-700">
                    Live
                  </Badge>
                )}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Deployment Tabs */}
      <Tabs defaultValue="deploy" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="deploy">Deploy</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="deploy" className="space-y-4">
          {/* Quick Deploy */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleDeploy("vercel")}>
              <CardContent className="p-4 text-center">
                <Globe className="h-8 w-8 mx-auto mb-2 text-black" />
                <h3 className="font-medium">Vercel</h3>
                <p className="text-sm text-slate-600">Deploy to Vercel</p>
                <Button className="w-full mt-3" disabled={isDeploying}>
                  {isDeploying && deploymentPlatform === "vercel" ? "Deploying..." : "Deploy"}
                </Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleDeploy("netlify")}>
              <CardContent className="p-4 text-center">
                <Server className="h-8 w-8 mx-auto mb-2 text-teal-600" />
                <h3 className="font-medium">Netlify</h3>
                <p className="text-sm text-slate-600">Deploy to Netlify</p>
                <Button className="w-full mt-3" disabled={isDeploying}>
                  {isDeploying && deploymentPlatform === "netlify" ? "Deploying..." : "Deploy"}
                </Button>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleDeploy("cloudflare")}
            >
              <CardContent className="p-4 text-center">
                <Cloud className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                <h3 className="font-medium">Cloudflare</h3>
                <p className="text-sm text-slate-600">Deploy to Cloudflare</p>
                <Button className="w-full mt-3" disabled={isDeploying}>
                  {isDeploying && deploymentPlatform === "cloudflare" ? "Deploying..." : "Deploy"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Custom Deploy */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Custom Deployment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Deployment Platform</label>
                  <Select value={deploymentPlatform} onValueChange={(value: any) => setDeploymentPlatform(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vercel">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          Vercel
                        </div>
                      </SelectItem>
                      <SelectItem value="netlify">
                        <div className="flex items-center gap-2">
                          <Server className="h-4 w-4" />
                          Netlify
                        </div>
                      </SelectItem>
                      <SelectItem value="cloudflare">
                        <div className="flex items-center gap-2">
                          <Cloud className="h-4 w-4" />
                          Cloudflare Pages
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="pt-6">
                  <Button onClick={() => handleDeploy()} disabled={isDeploying} className="min-w-32">
                    {isDeploying ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Deploying...
                      </>
                    ) : (
                      <>
                        <Rocket className="h-4 w-4 mr-2" />
                        Deploy
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {isDeploying && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Deployment Progress</span>
                    <span>{deploymentProgress}%</span>
                  </div>
                  <Progress value={deploymentProgress} className="h-2" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Deployment Logs */}
          <Card>
            <CardHeader>
              <CardTitle>Deployment Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64 w-full border rounded-lg p-4" ref={logsRef}>
                {deploymentLogs.length > 0 ? (
                  <div className="space-y-2">
                    {deploymentLogs.map((log) => (
                      <div key={log.id} className="flex items-start gap-3 text-sm">
                        {getLogIcon(log.level)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <span className={getLogColor(log.level)}>{log.message}</span>
                          </div>
                          {log.details && (
                            <pre className="text-xs text-slate-600 mt-1 bg-slate-50 p-2 rounded">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-slate-500 py-8">
                    <Rocket className="h-8 w-8 mx-auto mb-2" />
                    <p>No deployment logs yet</p>
                    <p className="text-sm">Deploy your project to see logs here</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Deployment History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {deploymentHistory.length > 0 ? (
                <div className="space-y-3">
                  {deploymentHistory.map((deployment) => (
                    <div key={deployment.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getPlatformIcon(deployment.platform)}
                        <div>
                          <p className="font-medium">{deployment.platform}</p>
                          <p className="text-sm text-slate-600">{new Date(deployment.timestamp).toLocaleString()}</p>
                          {deployment.buildTime && (
                            <p className="text-xs text-slate-500">Build time: {deployment.buildTime}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={deployment.status === "success" ? "default" : "destructive"}>
                          {deployment.status}
                        </Badge>
                        {deployment.url && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={deployment.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => handleRedeploy(deployment)}>
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-slate-500 py-8">
                  <History className="h-8 w-8 mx-auto mb-2" />
                  <p>No deployment history</p>
                  <p className="text-sm">Your deployments will appear here</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                AI Auto-Fix
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Automatic Error Fixing</p>
                  <p className="text-sm text-slate-600">Let AI automatically fix deployment errors and redeploy</p>
                </div>
                <Button
                  variant={autoFixEnabled ? "default" : "outline"}
                  onClick={() => setAutoFixEnabled(!autoFixEnabled)}
                >
                  {autoFixEnabled ? "Enabled" : "Disabled"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
