"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { GitBranch, Calendar, Users, Activity, RefreshCw, Download, Eye } from "lucide-react"

import { TaskList } from "@/components/task-list"
import { WebContainerPreview } from "@/components/webcontainer-preview"
import { SprintBoard } from "@/components/sprint-board"
import { DeploymentPanel } from "@/components/deployment-panel"
import { FloatingChat } from "@/components/floating-chat"
import { Shell } from "@/components/shell"

interface Project {
  id: string
  name: string
  description: string
  framework: string
  repository: string
  status: string
  progress: number
  deployment_url?: string
  deployment_platform?: string
  created_at: string
  updated_at: string
}

export default function ProjectPage() {
  const params = useParams()
  const projectId = params.id as string
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProject()
  }, [projectId])

  const loadProject = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        setProject(data.project)
      }
    } catch (error) {
      console.error("Error loading project:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleTaskUpdate = (taskId: string, action: string) => {
    console.log(`Task ${taskId} ${action}`)
    loadProject()
  }

  const handleChatUpdate = (message: string, type: string) => {
    console.log(`Chat update: ${type} - ${message}`)
    if (type === "task_created" || type === "implementation_completed") {
      loadProject()
    }
  }

  const handleDownloadProject = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/download`, {
        credentials: "include",
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${project?.name || "project"}.zip`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error("Error downloading project:", error)
    }
  }

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center min-h-screen">
          <RefreshCw className="h-8 w-8 animate-spin" />
        </div>
      </Shell>
    )
  }

  if (!project) {
    return (
      <Shell>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-slate-900 mb-2">Project not found</h2>
            <p className="text-slate-600">
              The project you're looking for doesn't exist or you don't have access to it.
            </p>
          </div>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="min-h-screen bg-slate-50">
        <div className="container mx-auto px-4 py-8">
          {/* Project Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">{project.name}</h1>
                <p className="text-slate-600 mt-1">{project.description}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="capitalize">
                  {project.framework}
                </Badge>
                <Badge variant={project.status === "active" ? "default" : "secondary"}>{project.status}</Badge>
                {project.deployment_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={project.deployment_url} target="_blank" rel="noopener noreferrer">
                      <Eye className="h-4 w-4 mr-2" />
                      Live Site
                    </a>
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleDownloadProject}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>

            {/* Project Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Activity className="h-8 w-8 text-blue-600" />
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{project.progress}%</p>
                      <p className="text-sm text-slate-600">Progress</p>
                    </div>
                  </div>
                  <Progress value={project.progress} className="mt-2" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <GitBranch className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="text-2xl font-bold text-slate-900">main</p>
                      <p className="text-sm text-slate-600">Branch</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-8 w-8 text-purple-600" />
                    <div>
                      <p className="text-2xl font-bold text-slate-900">
                        {new Date(project.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-slate-600">Created</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Users className="h-8 w-8 text-orange-600" />
                    <div>
                      <p className="text-2xl font-bold text-slate-900">1</p>
                      <p className="text-sm text-slate-600">Contributors</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Project Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="code">Code</TabsTrigger>
              <TabsTrigger value="deploy">Deploy</TabsTrigger>
              <TabsTrigger value="sprints">Sprints</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Repository Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="font-medium">Repository</p>
                      <p className="text-sm text-slate-600">{project.repository}</p>
                    </div>
                    <div>
                      <p className="font-medium">Framework</p>
                      <p className="text-sm text-slate-600">{project.framework}</p>
                    </div>
                    <div>
                      <p className="font-medium">Last Updated</p>
                      <p className="text-sm text-slate-600">{new Date(project.updated_at).toLocaleString()}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button className="w-full" onClick={() => document.querySelector('[value="tasks"]')?.click()}>
                      View Tasks
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => document.querySelector('[value="code"]')?.click()}
                    >
                      Browse Code
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => document.querySelector('[value="deploy"]')?.click()}
                    >
                      Deploy Project
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="tasks">
              <TaskList projectId={projectId} onTaskUpdate={handleTaskUpdate} />
            </TabsContent>

            <TabsContent value="code">
              <WebContainerPreview projectId={projectId} />
            </TabsContent>

            <TabsContent value="deploy">
              <DeploymentPanel projectId={projectId} project={project} />
            </TabsContent>

            <TabsContent value="sprints">
              <SprintBoard projectId={projectId} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Floating Chat */}
        <FloatingChat projectId={projectId} projectName={project.name} onUpdate={handleChatUpdate} />
      </div>
    </Shell>
  )
}
