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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Smartphone, Globe, Database, Zap, GitBranch, Loader2, AlertCircle, Bot, Lightbulb } from "lucide-react"

interface CreateProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onProjectCreated: () => void
}

const projectTemplates = [
  {
    id: "web-app",
    name: "Web Application",
    description: "Full-stack web application with modern UI",
    icon: Globe,
    frameworks: ["Next.js", "React", "Vue.js", "Svelte"],
    features: ["Authentication", "Database", "API Routes", "Responsive Design"],
  },
  {
    id: "mobile-app",
    name: "Mobile Application",
    description: "Cross-platform mobile app with native features",
    icon: Smartphone,
    frameworks: ["React Native", "Flutter", "Ionic"],
    features: ["Native UI", "Push Notifications", "Offline Support", "Device APIs"],
  },
  {
    id: "api-service",
    name: "API Service",
    description: "RESTful API with database integration",
    icon: Database,
    frameworks: ["Node.js", "Python", "Go", "Rust"],
    features: ["REST API", "Database ORM", "Authentication", "Documentation"],
  },
  {
    id: "ai-app",
    name: "AI-Powered App",
    description: "Application with integrated AI capabilities",
    icon: Zap,
    frameworks: ["Next.js", "Python", "Node.js"],
    features: ["AI Integration", "Chat Interface", "Model Training", "Analytics"],
  },
]

export function CreateProjectDialog({ open, onOpenChange, onProjectCreated }: CreateProjectDialogProps) {
  const [step, setStep] = useState(1)
  const [selectedTemplate, setSelectedTemplate] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [generateAITasks, setGenerateAITasks] = useState(false)
  const [projectData, setProjectData] = useState({
    name: "",
    description: "",
    framework: "",
    context: "",
    aiTaskContext: "",
  })

  const handleNext = () => {
    if (step < 3) setStep(step + 1)
  }

  const handleBack = () => {
    if (step > 1) setStep(step - 1)
  }

  const handleCreate = async () => {
    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: projectData.name,
          description: projectData.description,
          framework: projectData.framework,
          template: selectedTemplate,
          context: projectData.context,
          generateAITasks,
          aiTaskContext: projectData.aiTaskContext,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create project")
      }

      // Reset form
      setStep(1)
      setSelectedTemplate("")
      setGenerateAITasks(false)
      setProjectData({
        name: "",
        description: "",
        framework: "",
        context: "",
        aiTaskContext: "",
      })

      onOpenChange(false)
      onProjectCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>Set up a new project with AI-powered development agents</DialogDescription>
        </DialogHeader>

        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-700">{error}</AlertDescription>
          </Alert>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Choose Project Type</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projectTemplates.map((template) => (
                  <Card
                    key={template.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedTemplate === template.id ? "ring-2 ring-blue-500 bg-blue-50" : "hover:bg-slate-50"
                    }`}
                    onClick={() => setSelectedTemplate(template.id)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <template.icon className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{template.name}</CardTitle>
                          <CardDescription className="text-sm">{template.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs font-medium text-slate-600 mb-2">Frameworks:</p>
                          <div className="flex flex-wrap gap-1">
                            {template.frameworks.map((framework) => (
                              <Badge key={framework} variant="secondary" className="text-xs">
                                {framework}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-600 mb-2">Features:</p>
                          <div className="flex flex-wrap gap-1">
                            {template.features.map((feature) => (
                              <Badge key={feature} variant="outline" className="text-xs">
                                {feature}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Project Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="project-name">Project Name</Label>
                  <Input
                    id="project-name"
                    placeholder="My Awesome App"
                    value={projectData.name}
                    onChange={(e) => setProjectData((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="framework">Framework</Label>
                  <Select
                    value={projectData.framework}
                    onValueChange={(value) => setProjectData((prev) => ({ ...prev, framework: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select framework" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedTemplate &&
                        projectTemplates
                          .find((t) => t.id === selectedTemplate)
                          ?.frameworks.map((framework) => (
                            <SelectItem key={framework} value={framework}>
                              {framework}
                            </SelectItem>
                          ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2 mt-4">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what your application should do..."
                  value={projectData.description}
                  onChange={(e) => setProjectData((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="space-y-2 mt-4">
                <Label htmlFor="context">Project Context & Goals</Label>
                <Textarea
                  id="context"
                  placeholder="Provide detailed context about what you want to build, target audience, key features, and any specific requirements..."
                  value={projectData.context}
                  onChange={(e) => setProjectData((prev) => ({ ...prev, context: e.target.value }))}
                  rows={4}
                />
                <p className="text-xs text-slate-500">
                  This context will help the AI understand your project better and provide more relevant assistance.
                </p>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <GitBranch className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-900">Repository Setup</span>
                </div>
                <p className="text-sm text-blue-700">
                  A new GitHub repository will be created automatically for your project with AI-generated starter code
                </p>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">AI Task Generation</h3>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="generate-ai-tasks"
                    checked={generateAITasks}
                    onChange={(e) => setGenerateAITasks(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="generate-ai-tasks" className="text-sm font-medium">
                    Generate AI tasks for this project
                  </Label>
                </div>

                {generateAITasks && (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="ai-task-context">Task Generation Context</Label>
                      <Textarea
                        id="ai-task-context"
                        placeholder="Describe specific features, functionality, or improvements you want the AI to create tasks for..."
                        value={projectData.aiTaskContext}
                        onChange={(e) => setProjectData((prev) => ({ ...prev, aiTaskContext: e.target.value }))}
                        rows={5}
                        className="mt-1"
                      />
                    </div>

                    <div className="bg-purple-50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Bot className="h-4 w-4 text-purple-600" />
                        <span className="font-medium text-purple-900">AI Task Examples</span>
                      </div>
                      <ul className="text-sm text-purple-700 space-y-1">
                        <li>• "Create user authentication with email/password and social login"</li>
                        <li>• "Build a responsive dashboard with data visualization charts"</li>
                        <li>• "Implement real-time notifications and messaging system"</li>
                        <li>• "Add payment processing with Stripe integration"</li>
                        <li>• "Create admin panel for user and content management"</li>
                      </ul>
                    </div>

                    <div className="bg-amber-50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Lightbulb className="h-4 w-4 text-amber-600" />
                        <span className="font-medium text-amber-900">Pro Tip</span>
                      </div>
                      <p className="text-sm text-amber-700">
                        The more specific you are about your requirements, the better the AI can generate relevant and
                        actionable tasks. Include details about user flows, technical requirements, and desired
                        outcomes.
                      </p>
                    </div>
                  </div>
                )}

                {!generateAITasks && (
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-sm text-slate-600">
                      You can always generate AI tasks later from the project dashboard. The AI will analyze your
                      project context and create relevant development tasks.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between">
          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="outline" onClick={handleBack} disabled={loading}>
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            {step < 3 ? (
              <Button
                onClick={handleNext}
                disabled={!selectedTemplate || (step === 2 && (!projectData.name || !projectData.framework))}
              >
                Next
              </Button>
            ) : (
              <Button
                onClick={handleCreate}
                disabled={
                  !projectData.name ||
                  !projectData.framework ||
                  loading ||
                  (generateAITasks && !projectData.aiTaskContext.trim())
                }
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Project"
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
