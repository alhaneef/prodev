"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { GitBranch, Github, Gitlab, CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface ImportProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImportProjectDialog({ open, onOpenChange }: ImportProjectDialogProps) {
  const [importMethod, setImportMethod] = useState<"github" | "gitlab" | "url">("github")
  const [repoUrl, setRepoUrl] = useState("")
  const [accessToken, setAccessToken] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<any>(null)

  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    // Simulate repository analysis
    setTimeout(() => {
      setAnalysisResult({
        name: "ProDev Platform",
        framework: "Next.js",
        language: "TypeScript",
        dependencies: ["React", "Tailwind CSS", "shadcn/ui"],
        structure: "App Router",
        hasTests: true,
        hasDocumentation: true,
      })
      setIsAnalyzing(false)
    }, 2000)
  }

  const handleImport = () => {
    // Handle project import logic here
    console.log("Importing project:", { repoUrl, accessToken, analysisResult })
    onOpenChange(false)
    setRepoUrl("")
    setAccessToken("")
    setAnalysisResult(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Existing Project</DialogTitle>
          <DialogDescription>
            Import a project from your Git repository to continue development with AI agents
          </DialogDescription>
        </DialogHeader>

        <Tabs value={importMethod} onValueChange={(value) => setImportMethod(value as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="github" className="flex items-center gap-2">
              <Github className="h-4 w-4" />
              GitHub
            </TabsTrigger>
            <TabsTrigger value="gitlab" className="flex items-center gap-2">
              <Gitlab className="h-4 w-4" />
              GitLab
            </TabsTrigger>
            <TabsTrigger value="url" className="flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              Git URL
            </TabsTrigger>
          </TabsList>

          <TabsContent value="github" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Github className="h-5 w-5" />
                  Import from GitHub
                </CardTitle>
                <CardDescription>Connect your GitHub repository to import an existing project</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="github-url">Repository URL</Label>
                  <Input
                    id="github-url"
                    placeholder="https://github.com/username/repository"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="github-token">Access Token (for private repos)</Label>
                  <Input
                    id="github-token"
                    type="password"
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                  />
                  <p className="text-xs text-slate-500">
                    Required for private repositories. Generate a token with repo access.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gitlab" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gitlab className="h-5 w-5" />
                  Import from GitLab
                </CardTitle>
                <CardDescription>Connect your GitLab repository to import an existing project</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="gitlab-url">Repository URL</Label>
                  <Input
                    id="gitlab-url"
                    placeholder="https://gitlab.com/username/repository"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gitlab-token">Access Token</Label>
                  <Input
                    id="gitlab-token"
                    type="password"
                    placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="url" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5" />
                  Import from Git URL
                </CardTitle>
                <CardDescription>Import from any Git repository using HTTPS or SSH URL</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="git-url">Git Repository URL</Label>
                  <Input
                    id="git-url"
                    placeholder="https://git.example.com/username/repository.git"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="git-credentials">Credentials (if required)</Label>
                  <Textarea id="git-credentials" placeholder="Username and password or SSH key details..." rows={3} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {repoUrl && (
          <div className="space-y-4">
            <Button onClick={handleAnalyze} disabled={isAnalyzing} className="w-full">
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing Repository...
                </>
              ) : (
                "Analyze Repository"
              )}
            </Button>

            {analysisResult && (
              <Card className="border-green-200 bg-green-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-800">
                    <CheckCircle className="h-5 w-5" />
                    Repository Analysis Complete
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-slate-700">Project Name</p>
                      <p className="text-sm text-slate-600">{analysisResult.name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">Framework</p>
                      <p className="text-sm text-slate-600">{analysisResult.framework}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">Language</p>
                      <p className="text-sm text-slate-600">{analysisResult.language}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">Structure</p>
                      <p className="text-sm text-slate-600">{analysisResult.structure}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-2">Dependencies</p>
                    <div className="flex flex-wrap gap-1">
                      {analysisResult.dependencies.map((dep: string) => (
                        <Badge key={dep} variant="secondary" className="text-xs">
                          {dep}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      {analysisResult.hasTests ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                      )}
                      <span className="text-sm">Tests</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {analysisResult.hasDocumentation ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                      )}
                      <span className="text-sm">Documentation</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!analysisResult}>
            Import Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
