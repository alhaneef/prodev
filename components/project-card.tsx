"use client"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { MoreHorizontal, GitBranch, Clock, Play, Settings, ExternalLink } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface Project {
  id: string
  name: string
  description: string
  status: "active" | "paused" | "completed"
  progress: number
  framework: string
  repository: string
  deploymentUrl?: string
  updatedAt: string
}

interface ProjectCardProps {
  project: Project
  onUpdate?: () => void
}

const statusColors = {
  active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  completed: "bg-purple-100 text-purple-700",
}

const statusLabels = {
  active: "Active",
  paused: "Paused",
  completed: "Completed",
}

export function ProjectCard({ project, onUpdate }: ProjectCardProps) {
  const handleDeploy = async () => {
    try {
      const response = await fetch("/api/deploy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: project.id,
          platform: "vercel", // Default to Vercel
        }),
      })

      const data = await response.json()
      if (data.success) {
        onUpdate?.()
      }
    } catch (error) {
      console.error("Deployment failed:", error)
    }
  }

  return (
    <Card className="bg-white border-slate-200 hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold text-slate-900 mb-1">{project.name}</CardTitle>
            <CardDescription className="text-slate-600">{project.description}</CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={`https://github.com/${project.repository}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Repository
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDeploy}>
                <Play className="mr-2 h-4 w-4" />
                Deploy
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <Badge variant="secondary" className={statusColors[project.status]}>
            {statusLabels[project.status]}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {project.framework}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-4">
          {/* Progress */}
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-slate-600">Progress</span>
              <span className="font-medium text-slate-900">{project.progress}%</span>
            </div>
            <Progress value={project.progress} className="h-2" />
          </div>

          {/* Repository */}
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <GitBranch className="h-4 w-4" />
            <span className="truncate">{project.repository}</span>
          </div>

          {/* Last Updated */}
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Clock className="h-4 w-4" />
            <span>Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
          </div>

          {/* Deployment URL */}
          {project.deploymentUrl && (
            <div className="flex items-center gap-2 text-sm">
              <ExternalLink className="h-4 w-4 text-green-600" />
              <a
                href={project.deploymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-600 hover:underline truncate"
              >
                Live App
              </a>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button asChild size="sm" className="flex-1">
              <Link href={`/projects/${project.id}`}>Open Project</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={handleDeploy}>
              <Play className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
