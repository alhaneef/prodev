"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

export interface Project {
  id: string
  name: string
  description?: string | null
  updatedAt?: string | Date
  status?: "draft" | "active" | "archived"
  tags?: string[]
}

export interface ProjectDetailsProps {
  project?: Project // if undefined we’ll show skeletons
  isLoading?: boolean
}

/**
 * Displays high-level information about a project.
 */
export function ProjectDetails({ project, isLoading }: ProjectDetailsProps) {
  if (isLoading || !project) {
    return (
      <Card className="w-full">
        <CardHeader>
          <Skeleton className="h-6 w-2/3" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </CardContent>
      </Card>
    )
  }

  const { name, description, updatedAt, status, tags } = project

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="truncate">{name}</span>
          {status && (
            <Badge variant={status === "active" ? "default" : "secondary"} className="capitalize">
              {status}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {description && <p className="text-sm leading-relaxed">{description}</p>}

        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {updatedAt && (
            <span>
              Last updated:{" "}
              {new Date(updatedAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
          {tags?.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/* Also export as default for convenience */
export default ProjectDetails
