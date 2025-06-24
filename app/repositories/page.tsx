"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { GitBranch, Github, ExternalLink, Star, GitCommit, Clock, Search, Plus, Loader2 } from "lucide-react"
import { useAuth } from "@/components/auth-provider"

interface Repository {
  id: string
  name: string
  fullName: string
  description: string
  language: string
  stars: number
  forks: number
  lastCommit: string
  isPrivate: boolean
  url: string
  defaultBranch: string
  size: number
}

export default function RepositoriesPage() {
  const { user, loading } = useAuth()
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [filteredRepos, setFilteredRepos] = useState<Repository[]>([])
  const [loadingRepos, setLoadingRepos] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    if (user) {
      loadRepositories()
    }
  }, [user])

  useEffect(() => {
    filterRepositories()
  }, [repositories, searchTerm])

  const loadRepositories = async () => {
    try {
      setLoadingRepos(true)
      const response = await fetch("/api/repositories", {
        credentials: "include",
      })
      const data = await response.json()

      if (data.success && data.repositories) {
        setRepositories(data.repositories)
      }
    } catch (error) {
      console.error("Error loading repositories:", error)
    } finally {
      setLoadingRepos(false)
    }
  }

  const filterRepositories = () => {
    if (!searchTerm) {
      setFilteredRepos(repositories)
      return
    }

    const filtered = repositories.filter(
      (repo) =>
        repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        repo.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        repo.language?.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    setFilteredRepos(filtered)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const getLanguageColor = (language: string) => {
    const colors: Record<string, string> = {
      JavaScript: "bg-yellow-100 text-yellow-700",
      TypeScript: "bg-blue-100 text-blue-700",
      Python: "bg-green-100 text-green-700",
      Java: "bg-red-100 text-red-700",
      "C++": "bg-purple-100 text-purple-700",
      Go: "bg-cyan-100 text-cyan-700",
      Rust: "bg-orange-100 text-orange-700",
      PHP: "bg-indigo-100 text-indigo-700",
    }
    return colors[language] || "bg-gray-100 text-gray-700"
  }

  const handleCloneRepository = async (repo: Repository) => {
    try {
      // Check if project already exists
      const existingProjects = await fetch("/api/projects", {
        credentials: "include",
      })
      const projectsData = await existingProjects.json()

      const existingProject = projectsData.projects?.find((p: any) => p.repository === repo.fullName)

      if (existingProject) {
        alert(`Project "${existingProject.name}" already exists for this repository.`)
        return
      }

      // Create new project from repository
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: repo.name,
          description: repo.description || `Cloned from ${repo.fullName}`,
          framework: detectFramework(repo.language),
          repository: repo.fullName,
          template: "existing",
        }),
      })

      if (response.ok) {
        const data = await response.json()
        alert(`Successfully cloned repository as project: ${data.project.name}`)
        // Redirect to the new project
        window.location.href = `/projects/${data.project.id}`
      } else {
        const error = await response.json()
        alert(`Failed to clone repository: ${error.error}`)
      }
    } catch (error) {
      console.error("Error cloning repository:", error)
      alert("Failed to clone repository. Please try again.")
    }
  }

  // Add framework detection helper
  const detectFramework = (language: string) => {
    const frameworkMap: Record<string, string> = {
      JavaScript: "React",
      TypeScript: "Next.js",
      Python: "Python",
      Java: "Java",
      "C++": "C++",
      Go: "Go",
      Rust: "Rust",
      PHP: "PHP",
    }
    return frameworkMap[language] || "React"
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-600">Please log in to view repositories.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Repositories</h1>
          <p className="text-slate-600">Manage your GitHub repositories and code</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          New Repository
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Repositories</CardTitle>
            <Github className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{repositories.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Private</CardTitle>
            <GitBranch className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{repositories.filter((r) => r.isPrivate).length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stars</CardTitle>
            <Star className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{repositories.reduce((acc, repo) => acc + repo.stars, 0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Languages</CardTitle>
            <GitCommit className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(repositories.map((r) => r.language).filter(Boolean)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Search Repositories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search repositories by name, description, or language..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Repositories List */}
      {loadingRepos ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRepos.map((repo) => (
            <Card key={repo.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Github className="h-5 w-5 text-slate-600" />
                      <h3 className="text-lg font-semibold text-slate-900">{repo.name}</h3>
                      {repo.isPrivate && (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                          Private
                        </Badge>
                      )}
                      {repo.language && (
                        <Badge variant="secondary" className={getLanguageColor(repo.language)}>
                          {repo.language}
                        </Badge>
                      )}
                    </div>

                    <p className="text-slate-600 mb-4">{repo.description || "No description available"}</p>

                    <div className="flex items-center gap-6 text-sm text-slate-500">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4" />
                        <span>{repo.stars}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <GitBranch className="h-4 w-4" />
                        <span>{repo.forks} forks</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>Updated {repo.lastCommit}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span>{formatFileSize(repo.size * 1024)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Button variant="outline" size="sm" asChild>
                      <a href={repo.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View on GitHub
                      </a>
                    </Button>
                    <Button size="sm" onClick={() => handleCloneRepository(repo)}>
                      <GitBranch className="h-4 w-4 mr-2" />
                      Clone
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredRepos.length === 0 && repositories.length > 0 && (
            <div className="text-center py-12">
              <Search className="h-12 w-12 mx-auto text-slate-400 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No repositories found</h3>
              <p className="text-slate-600">Try adjusting your search criteria</p>
            </div>
          )}

          {repositories.length === 0 && (
            <div className="text-center py-12">
              <Github className="h-12 w-12 mx-auto text-slate-400 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No repositories yet</h3>
              <p className="text-slate-600 mb-4">Connect your GitHub account to see your repositories</p>
              <Button>
                <Github className="w-4 h-4 mr-2" />
                Connect GitHub
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
