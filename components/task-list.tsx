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
import { Plus, Play, CheckCircle, Clock, AlertCircle, Edit, Trash2, Zap, RefreshCw, Filter, Search } from "lucide-react"

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
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium" as const,
    estimatedTime: "2 hours",
  })

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

  const handleImplementTask = async (taskId: string) => {
    setImplementing(taskId)
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

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Update task status in local state
          setTasks((prev) =>
            prev.map((task) =>
              task.id === taskId ? { ...task, status: "completed", updatedAt: new Date().toISOString() } : task,
            ),
          )
          onTaskUpdate?.(taskId, "implemented")
        } else {
          // Mark as failed
          setTasks((prev) =>
            prev.map((task) =>
              task.id === taskId ? { ...task, status: "failed", updatedAt: new Date().toISOString() } : task,
            ),
          )
        }
      }
    } catch (error) {
      console.error("Error implementing task:", error)
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

      if (response.ok) {
        const data = await response.json()
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
        }
      }
    } catch (error) {
      console.error("Error implementing all tasks:", error)
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
                        </div>
                        <p className="text-sm text-slate-600 mb-2">{task.description}</p>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span>Estimated: {task.estimatedTime}</span>
                          <span>Created: {new Date(task.createdAt).toLocaleDateString()}</span>
                          <span>Type: {task.type}</span>
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
                        <Button variant="outline" size="sm">
                          <Edit className="h-3 w-3" />
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
                <p className="text-sm">Create your first task to get started</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
