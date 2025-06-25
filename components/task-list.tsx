"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Plus,
  Play,
  CheckCircle,
  Clock,
  AlertCircle,
  Edit,
  Trash2,
  Zap,
  RefreshCw,
  Filter,
  Search,
  Bot,
  FileText,
  Lightbulb,
} from "lucide-react"

interface Task {
  id: string
  title: string
  description: string
  status: "pending" | "in-progress" | "completed" | "failed"
  priority: "low" | "medium" | "high"
  type: "ai-generated" | "manual"
  estimatedTime: string
  createdAt: string
  updatedAt: string
  files?: string[]
  dependencies?: string[]
  subtasks?: Task[]
  parentTaskId?: string
  operations?: Array<"create" | "read" | "update" | "delete">
  context?: string
}

interface TaskListProps {
  projectId: string
  onTaskUpdate?: (taskId: string, action: string) => void
}

export function TaskList({ projectId, onTaskUpdate }: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [implementing, setImplementing] = useState<string | null>(null)
  const [implementingAll, setImplementingAll] = useState(false)
  const [generatingTasks, setGeneratingTasks] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showAITaskDialog, setShowAITaskDialog] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [aiTaskContext, setAiTaskContext] = useState("")
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium" as const,
    estimatedTime: "2 hours",
  })

  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showTaskDialog, setShowTaskDialog] = useState(false)
  const [taskFiles, setTaskFiles] = useState<string[]>([])
  const [newFileName, setNewFileName] = useState("")
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("")

  useEffect(() => {
    loadTasks()
  }, [projectId])

  const loadTasks = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/tasks?projectId=${projectId}`, {
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setTasks(data.tasks || [])
        }
      }
    } catch (error) {
      console.error("Error loading tasks:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) return

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId,
          action: "create",
          taskData: newTask,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setTasks((prev) => [data.task, ...prev])
          setNewTask({
            title: "",
            description: "",
            priority: "medium",
            estimatedTime: "2 hours",
          })
          setShowCreateDialog(false)
          onTaskUpdate?.(data.task.id, "created")
        }
      }
    } catch (error) {
      console.error("Error creating task:", error)
    }
  }

  const handleGenerateAITasks = async () => {
    if (!aiTaskContext.trim()) {
      alert("Please provide context for AI task generation")
      return
    }

    setGeneratingTasks(true)
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId,
          action: "generate_ai_tasks",
          context: aiTaskContext,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          await loadTasks() // Reload tasks to show generated ones
          setShowAITaskDialog(false)
          setAiTaskContext("")
          onTaskUpdate?.("ai_generated", "generated")
        }
      }
    } catch (error) {
      console.error("Error generating AI tasks:", error)
    } finally {
      setGeneratingTasks(false)
    }
  }

  const handleImplementTask = async (taskId: string) => {
    setImplementing(taskId)
    console.log(`🔨 Starting implementation of task: ${taskId}`)

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId,
          action: "implement",
          taskId,
        }),
      })

      const data = await response.json()
      console.log("📊 Task implementation response:", data)

      if (data.success) {
        // Update task status in local state
        setTasks((prev) =>
          prev.map((task) =>
            task.id === taskId ? { ...task, status: "completed", updatedAt: new Date().toISOString() } : task,
          ),
        )
        onTaskUpdate?.(taskId, "implemented")
        console.log(`✅ Task ${taskId} implemented successfully`)
      } else {
        console.error(`❌ Task ${taskId} implementation failed:`, data.error)
        // Mark as failed
        setTasks((prev) =>
          prev.map((task) =>
            task.id === taskId ? { ...task, status: "failed", updatedAt: new Date().toISOString() } : task,
          ),
        )
      }
    } catch (error) {
      console.error(`❌ Error implementing task ${taskId}:`, error)
      // Mark as failed
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId ? { ...task, status: "failed", updatedAt: new Date().toISOString() } : task,
        ),
      )
    } finally {
      setImplementing(null)
    }
  }

  const handleImplementAll = async () => {
    setImplementingAll(true)
    console.log("🤖 Starting implementation of all pending tasks...")

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId,
          action: "implement_all",
        }),
      })

      const data = await response.json()
      console.log("📊 Implement all response:", data)

      if (data.success) {
        // Update task statuses based on results
        setTasks((prev) =>
          prev.map((task) => {
            const result = data.results.find((r: any) => r.taskId === task.id)
            if (result) {
              return {
                ...task,
                status: result.status,
                updatedAt: new Date().toISOString(),
              }
            }
            return task
          }),
        )
        onTaskUpdate?.("all", "implemented")
        console.log(`✅ Implemented all tasks: ${data.results.length} processed`)
      } else {
        console.error("❌ Implement all failed:", data.error)
      }
    } catch (error) {
      console.error("❌ Error implementing all tasks:", error)
    } finally {
      setImplementingAll(false)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId,
          action: "delete",
          taskId,
        }),
      })

      if (response.ok) {
        setTasks((prev) => prev.filter((task) => task.id !== taskId))
        onTaskUpdate?.(taskId, "deleted")
      }
    } catch (error) {
      console.error("Error deleting task:", error)
    }
  }

  const getStatusIcon = (status: Task["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "in-progress":
        return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-600" />
      default:
        return <Clock className="h-4 w-4 text-slate-600" />
    }
  }

  const getStatusColor = (status: Task["status"]) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-700"
      case "in-progress":
        return "bg-blue-100 text-blue-700"
      case "failed":
        return "bg-red-100 text-red-700"
      default:
        return "bg-slate-100 text-slate-700"
    }
  }

  const getPriorityColor = (priority: Task["priority"]) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-700"
      case "medium":
        return "bg-yellow-100 text-yellow-700"
      default:
        return "bg-green-100 text-green-700"
    }
  }

  const filteredTasks = tasks.filter((task) => {
    const matchesStatus = filterStatus === "all" || task.status === filterStatus
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const pendingTasksCount = tasks.filter((t) => t.status === "pending").length

  const handleUpdateTaskFiles = async (taskId: string, files: string[]) => {
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId,
          action: "update_files",
          taskId,
          files,
        }),
      })

      if (response.ok) {
        // Refresh tasks
        loadTasks()
      }
    } catch (error) {
      console.error("Error updating task files:", error)
    }
  }

  const handleAddSubtask = async (parentTaskId: string, subtaskTitle: string) => {
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId,
          action: "create_subtask",
          parentTaskId,
          taskData: {
            title: subtaskTitle,
            description: `Subtask of ${tasks.find((t) => t.id === parentTaskId)?.title}`,
            priority: "medium",
            estimatedTime: "1 hour",
          },
        }),
      })

      if (response.ok) {
        loadTasks() // Refresh tasks
      }
    } catch (error) {
      console.error("Error creating subtask:", error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Tasks</h2>
          <p className="text-slate-600">Manage and track your project tasks</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadTasks} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Dialog open={showAITaskDialog} onOpenChange={setShowAITaskDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Bot className="h-4 w-4 mr-2" />
                Generate AI Tasks
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Generate AI Tasks</DialogTitle>
                <DialogDescription>
                  Provide context about what you want to build or achieve, and AI will generate relevant tasks
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Project Context & Goals</label>
                  <Textarea
                    value={aiTaskContext}
                    onChange={(e) => setAiTaskContext(e.target.value)}
                    placeholder="Describe what you want to build, features to add, problems to solve, or improvements to make. Be as specific as possible..."
                    rows={6}
                    className="mt-1"
                  />
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-900">Examples:</span>
                  </div>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• "Build a user authentication system with login, signup, and password reset"</li>
                    <li>• "Add a dashboard with charts showing user analytics and metrics"</li>
                    <li>• "Implement a real-time chat feature with message history"</li>
                    <li>• "Create an e-commerce product catalog with search and filtering"</li>
                  </ul>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAITaskDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleGenerateAITasks} disabled={generatingTasks || !aiTaskContext.trim()}>
                  {generatingTasks ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Bot className="mr-2 h-4 w-4" />
                      Generate Tasks
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {pendingTasksCount > 0 && (
            <Button onClick={handleImplementAll} disabled={implementingAll}>
              <Zap className="h-4 w-4 mr-2" />
              {implementingAll ? "Implementing..." : `Implement All (${pendingTasksCount})`}
            </Button>
          )}
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Task
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
                <DialogDescription>Add a new task to your project</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    placeholder="Enter task title"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    placeholder="Enter task description"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Priority</label>
                    <Select
                      value={newTask.priority}
                      onValueChange={(value: any) => setNewTask({ ...newTask, priority: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Estimated Time</label>
                    <Input
                      value={newTask.estimatedTime}
                      onChange={(e) => setNewTask({ ...newTask, estimatedTime: e.target.value })}
                      placeholder="e.g., 2 hours"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateTask} disabled={!newTask.title.trim()}>
                  Create Task
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in-progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Task List */}
      <Card>
        <CardHeader>
          <CardTitle>Tasks ({filteredTasks.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : filteredTasks.length > 0 ? (
              <div className="space-y-3">
                {filteredTasks.map((task) => (
                  <div key={task.id} className="border rounded-lg p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getStatusIcon(task.status)}
                          <h3 className="font-medium text-slate-900">{task.title}</h3>
                          <Badge variant="outline" className={getPriorityColor(task.priority)}>
                            {task.priority}
                          </Badge>
                          <Badge variant="outline" className={getStatusColor(task.status)}>
                            {task.status}
                          </Badge>
                          {task.type === "ai-generated" && (
                            <Badge variant="outline" className="bg-purple-100 text-purple-700">
                              <Bot className="h-3 w-3 mr-1" />
                              AI
                            </Badge>
                          )}
                          {task.parentTaskId && (
                            <Badge variant="outline" className="bg-orange-100 text-orange-700">
                              Subtask
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 mb-2">{task.description}</p>

                        {/* Task Context */}
                        {task.context && (
                          <div className="mb-2">
                            <p className="text-xs font-medium text-slate-700 mb-1">Context:</p>
                            <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded">{task.context}</p>
                          </div>
                        )}

                        {/* Operations */}
                        {task.operations && task.operations.length > 0 && (
                          <div className="mb-2">
                            <p className="text-xs font-medium text-slate-700 mb-1">Operations:</p>
                            <div className="flex flex-wrap gap-1">
                              {task.operations.map((op, index) => (
                                <Badge key={index} variant="outline" className="text-xs bg-green-50 text-green-700">
                                  {op.toUpperCase()}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Associated Files */}
                        {task.files && task.files.length > 0 && (
                          <div className="mb-2">
                            <p className="text-xs font-medium text-slate-700 mb-1">Associated Files:</p>
                            <div className="flex flex-wrap gap-1">
                              {task.files.map((file, index) => (
                                <Badge key={index} variant="outline" className="text-xs bg-blue-50 text-blue-700">
                                  <FileText className="h-3 w-3 mr-1" />
                                  {file}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Subtasks */}
                        {task.subtasks && task.subtasks.length > 0 && (
                          <div className="mb-2">
                            <p className="text-xs font-medium text-slate-700 mb-1">
                              Subtasks ({task.subtasks.filter((st) => st.status === "completed").length}/
                              {task.subtasks.length}):
                            </p>
                            <div className="space-y-1 ml-4 border-l-2 border-slate-200 pl-3">
                              {task.subtasks.map((subtask) => (
                                <div key={subtask.id} className="flex items-center gap-2 text-xs">
                                  {getStatusIcon(subtask.status)}
                                  <span className={subtask.status === "completed" ? "line-through text-slate-500" : ""}>
                                    {subtask.title}
                                  </span>
                                  <Badge variant="outline" className={getStatusColor(subtask.status)}>
                                    {subtask.status}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span>Estimated: {task.estimatedTime}</span>
                          <span>Created: {new Date(task.createdAt).toLocaleDateString()}</span>
                          <span>Type: {task.type}</span>
                          {task.files && <span>Files: {task.files.length}</span>}
                          {task.subtasks && <span>Subtasks: {task.subtasks.length}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {task.status === "pending" && (
                          <Button
                            size="sm"
                            onClick={() => handleImplementTask(task.id)}
                            disabled={implementing === task.id}
                          >
                            {implementing === task.id ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <Play className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedTask(task)
                            setTaskFiles(task.files || [])
                            setShowTaskDialog(true)
                          }}
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Manage
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDeleteTask(task.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-slate-500 py-8">
                <Clock className="h-8 w-8 mx-auto mb-2" />
                <p className="text-lg font-medium mb-2">No tasks found</p>
                <p className="text-sm">Create your first task or generate AI tasks to get started</p>
                <div className="flex gap-2 justify-center mt-4">
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Task
                  </Button>
                  <Button variant="outline" onClick={() => setShowAITaskDialog(true)}>
                    <Bot className="h-4 w-4 mr-2" />
                    Generate AI Tasks
                  </Button>
                </div>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Task: {selectedTask?.title}</DialogTitle>
            <DialogDescription>Add files and subtasks to this task</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Associated Files Section */}
            <div>
              <h4 className="font-medium mb-2">Associated Files</h4>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter file path (e.g., src/components/Header.tsx)"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      if (newFileName.trim()) {
                        setTaskFiles([...taskFiles, newFileName.trim()])
                        setNewFileName("")
                      }
                    }}
                  >
                    Add File
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {taskFiles.map((file, index) => (
                    <Badge key={index} variant="outline" className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {file}
                      <button
                        onClick={() => setTaskFiles(taskFiles.filter((_, i) => i !== index))}
                        className="ml-1 text-red-500 hover:text-red-700"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* Subtasks Section */}
            <div>
              <h4 className="font-medium mb-2">Subtasks</h4>
              {selectedTask?.subtasks && selectedTask.subtasks.length > 0 && (
                <div className="space-y-2 mb-3">
                  {selectedTask.subtasks.map((subtask) => (
                    <div key={subtask.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(subtask.status)}
                        <span className="text-sm">{subtask.title}</span>
                      </div>
                      <Badge variant="outline" className={getStatusColor(subtask.status)}>
                        {subtask.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Enter subtask title"
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (newSubtaskTitle.trim() && selectedTask) {
                      handleAddSubtask(selectedTask.id, newSubtaskTitle.trim())
                      setNewSubtaskTitle("")
                    }
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTaskDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (selectedTask) {
                  await handleUpdateTaskFiles(selectedTask.id, taskFiles)
                  setShowTaskDialog(false)
                }
              }}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
