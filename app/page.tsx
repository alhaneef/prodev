"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, GitBranch, Zap, Settings, Code, Rocket, Loader2 } from "lucide-react"
import { ProjectCard } from "@/components/project-card"
import { CreateProjectDialog } from "@/components/create-project-dialog"
import { ImportProjectDialog } from "@/components/import-project-dialog"
import { LoginForm } from "@/components/login-form"
import { useAuth } from "@/components/auth-provider"

export default function Dashboard() {
  const { user, loading } = useAuth()
  const [projects, setProjects] = useState<any[]>([])
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [loadingProjects, setLoadingProjects] = useState(true)

  useEffect(() => {
    if (user) {
      loadUserProjects()
    }
  }, [user])

  const loadUserProjects = async () => {
    try {
      setLoadingProjects(true)
      const response = await fetch("/api/projects", {
        credentials: "include",
      })
      const data = await response.json()

      if (data.success && data.projects) {
        setProjects(data.projects)
      }
    } catch (error) {
      console.error("Error loading projects:", error)
    } finally {
      setLoadingProjects(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <LoginForm />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">ProDev Platform</h1>
            <p className="text-slate-600">Build applications with AI-powered development agents</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowImportDialog(true)}
              className="bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
            >
              <GitBranch className="w-4 h-4 mr-2" />
              Import Project
            </Button>
            <Button onClick={() => setShowCreateDialog(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Active Projects</CardTitle>
              <Code className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">
                {projects.filter((p) => p.status === "active").length}
              </div>
              <p className="text-xs text-slate-500">Currently in development</p>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">AI Tasks Completed</CardTitle>
              <Zap className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">
                {projects.reduce((acc, p) => acc + Math.floor(p.progress / 10), 0)}
              </div>
              <p className="text-xs text-slate-500">Automated implementations</p>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Deployments</CardTitle>
              <Rocket className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{projects.filter((p) => p.deployment_url).length}</div>
              <p className="text-xs text-slate-500">Live applications</p>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Success Rate</CardTitle>
              <Settings className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">
                {projects.length > 0
                  ? Math.round((projects.filter((p) => p.status === "completed").length / projects.length) * 100)
                  : 0}
                %
              </div>
              <p className="text-xs text-slate-500">Project completion rate</p>
            </CardContent>
          </Card>
        </div>

        {/* Projects Grid */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-slate-900 mb-6">Your Projects</h2>

          {loadingProjects ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} onUpdate={loadUserProjects} />
              ))}

              {/* Create New Project Card */}
              <Card
                className="border-2 border-dashed border-slate-300 hover:border-blue-400 cursor-pointer transition-colors bg-white"
                onClick={() => setShowCreateDialog(true)}
              >
                <CardContent className="flex flex-col items-center justify-center h-48 text-slate-500 hover:text-blue-600 transition-colors">
                  <Plus className="w-12 h-12 mb-4" />
                  <p className="text-lg font-medium">Create New Project</p>
                  <p className="text-sm text-center">Start building with AI agents</p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <Card className="bg-white border-slate-200">
          <CardHeader>
            <CardTitle className="text-slate-900">Recent Activity</CardTitle>
            <CardDescription>Latest updates from your AI development agents</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {projects.slice(0, 3).map((project, index) => (
                <div key={project.id} className="flex items-center gap-4 p-3 rounded-lg bg-slate-50">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      project.status === "active"
                        ? "bg-blue-500 animate-pulse"
                        : project.status === "completed"
                          ? "bg-green-500"
                          : "bg-yellow-500"
                    }`}
                  ></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">
                      {project.status === "active" ? "AI Agent working on" : "Project"}: {project.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {project.framework} • Updated {new Date(project.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={
                      project.status === "active"
                        ? "bg-blue-100 text-blue-700"
                        : project.status === "completed"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                    }
                  >
                    {project.status}
                  </Badge>
                </div>
              ))}

              {projects.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <Code className="h-12 w-12 mx-auto mb-4" />
                  <p className="text-lg font-medium mb-2">No projects yet</p>
                  <p className="text-sm">Create your first project to get started with AI development</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <CreateProjectDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onProjectCreated={loadUserProjects}
      />
      <ImportProjectDialog open={showImportDialog} onOpenChange={setShowImportDialog} />
    </div>
  )
}
