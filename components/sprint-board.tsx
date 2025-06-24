"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Calendar, Target, Play, CheckCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Droppable, Draggable } from "@hello-pangea/dnd"

interface Sprint {
  id: string
  name: string
  description: string
  status: "planning" | "active" | "completed"
  startDate: string
  endDate: string
  goals: string[]
  tasks: string[]
  progress: number
  createdAt: string
}

interface SprintBoardProps {
  projectId: string
}

export function SprintBoard({ projectId }: SprintBoardProps) {
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newSprint, setNewSprint] = useState({
    name: "",
    description: "",
    startDate: "",
    endDate: "",
    goals: [""],
  })

  useEffect(() => {
    loadSprints()
  }, [projectId])

  const loadSprints = async () => {
    // Load sprints from GitHub repo or Firebase
    const mockSprints: Sprint[] = [
      {
        id: "1",
        name: "MVP Development",
        description: "Core features for minimum viable product",
        status: "active",
        startDate: "2024-01-15",
        endDate: "2024-01-29",
        goals: ["User authentication", "Basic CRUD operations", "Responsive UI"],
        tasks: ["task_1", "task_2", "task_3"],
        progress: 65,
        createdAt: "2024-01-15T00:00:00Z",
      },
      {
        id: "2",
        name: "Advanced Features",
        description: "Enhanced functionality and integrations",
        status: "planning",
        startDate: "2024-01-30",
        endDate: "2024-02-13",
        goals: ["Payment integration", "Real-time notifications", "Analytics dashboard"],
        tasks: ["task_4", "task_5"],
        progress: 0,
        createdAt: "2024-01-15T00:00:00Z",
      },
    ]
    setSprints(mockSprints)
  }

  const handleCreateSprint = async () => {
    const sprint: Sprint = {
      id: `sprint_${Date.now()}`,
      name: newSprint.name,
      description: newSprint.description,
      status: "planning",
      startDate: newSprint.startDate,
      endDate: newSprint.endDate,
      goals: newSprint.goals.filter((goal) => goal.trim() !== ""),
      tasks: [],
      progress: 0,
      createdAt: new Date().toISOString(),
    }

    setSprints((prev) => [...prev, sprint])
    setNewSprint({ name: "", description: "", startDate: "", endDate: "", goals: [""] })
    setShowCreateDialog(false)
  }

  const handleStartSprint = (sprintId: string) => {
    setSprints((prev) =>
      prev.map((sprint) => (sprint.id === sprintId ? { ...sprint, status: "active" as const } : sprint)),
    )
  }

  const handleCompleteSprint = (sprintId: string) => {
    setSprints((prev) =>
      prev.map((sprint) =>
        sprint.id === sprintId ? { ...sprint, status: "completed" as const, progress: 100 } : sprint,
      ),
    )
  }

  const addGoal = () => {
    setNewSprint((prev) => ({ ...prev, goals: [...prev.goals, ""] }))
  }

  const updateGoal = (index: number, value: string) => {
    setNewSprint((prev) => ({
      ...prev,
      goals: prev.goals.map((goal, i) => (i === index ? value : goal)),
    }))
  }

  const removeGoal = (index: number) => {
    setNewSprint((prev) => ({
      ...prev,
      goals: prev.goals.filter((_, i) => i !== index),
    }))
  }

  const getStatusColor = (status: Sprint["status"]) => {
    switch (status) {
      case "planning":
        return "bg-yellow-100 text-yellow-700"
      case "active":
        return "bg-blue-100 text-blue-700"
      case "completed":
        return "bg-green-100 text-green-700"
      default:
        return "bg-gray-100 text-gray-700"
    }
  }

  const getStatusIcon = (status: Sprint["status"]) => {
    switch (status) {
      case "planning":
        return Calendar
      case "active":
        return Play
      case "completed":
        return CheckCircle
      default:
        return Calendar
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Sprint Board</h2>
          <p className="text-slate-600">Manage development sprints and track progress</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Sprint
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Sprint</DialogTitle>
              <DialogDescription>Plan your next development sprint</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sprint-name">Sprint Name</Label>
                  <Input
                    id="sprint-name"
                    placeholder="Sprint 1: Core Features"
                    value={newSprint.name}
                    onChange={(e) => setNewSprint((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sprint-duration">Duration</Label>
                  <Select defaultValue="2-weeks">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1-week">1 Week</SelectItem>
                      <SelectItem value="2-weeks">2 Weeks</SelectItem>
                      <SelectItem value="3-weeks">3 Weeks</SelectItem>
                      <SelectItem value="4-weeks">4 Weeks</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={newSprint.startDate}
                    onChange={(e) => setNewSprint((prev) => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={newSprint.endDate}
                    onChange={(e) => setNewSprint((prev) => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the sprint objectives..."
                  value={newSprint.description}
                  onChange={(e) => setNewSprint((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Sprint Goals</Label>
                {newSprint.goals.map((goal, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder={`Goal ${index + 1}`}
                      value={goal}
                      onChange={(e) => updateGoal(index, e.target.value)}
                    />
                    {newSprint.goals.length > 1 && (
                      <Button variant="outline" size="sm" onClick={() => removeGoal(index)}>
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addGoal}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Goal
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateSprint} disabled={!newSprint.name}>
                Create Sprint
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Sprint Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {["planning", "active", "completed"].map((status) => {
          const statusSprints = sprints.filter((sprint) => sprint.status === status)
          const StatusIcon = getStatusIcon(status as Sprint["status"])

          return (
            <div key={status} className="space-y-4">
              <div className="flex items-center gap-2">
                <StatusIcon className="h-5 w-5" />
                <h3 className="text-lg font-semibold capitalize">{status}</h3>
                <Badge variant="secondary">{statusSprints.length}</Badge>
              </div>

              <Droppable droppableId={status}>
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3 min-h-[200px]">
                    {statusSprints.map((sprint, index) => (
                      <Draggable key={sprint.id} draggableId={sprint.id} index={index}>
                        {(provided) => (
                          <Card
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className="cursor-move hover:shadow-md transition-shadow"
                          >
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between">
                                <div>
                                  <CardTitle className="text-base">{sprint.name}</CardTitle>
                                  <CardDescription className="text-sm">{sprint.description}</CardDescription>
                                </div>
                                <Badge variant="secondary" className={getStatusColor(sprint.status)}>
                                  {sprint.status}
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="text-sm text-slate-600">
                                <p>
                                  {new Date(sprint.startDate).toLocaleDateString()} -{" "}
                                  {new Date(sprint.endDate).toLocaleDateString()}
                                </p>
                              </div>

                              {sprint.goals.length > 0 && (
                                <div>
                                  <p className="text-sm font-medium text-slate-700 mb-2">Goals:</p>
                                  <ul className="text-sm text-slate-600 space-y-1">
                                    {sprint.goals.map((goal, index) => (
                                      <li key={index} className="flex items-center gap-2">
                                        <Target className="h-3 w-3" />
                                        {goal}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {sprint.status === "active" && (
                                <div>
                                  <div className="flex items-center justify-between text-sm mb-2">
                                    <span>Progress</span>
                                    <span>{sprint.progress}%</span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                      className="bg-blue-600 h-2 rounded-full transition-all"
                                      style={{ width: `${sprint.progress}%` }}
                                    />
                                  </div>
                                </div>
                              )}

                              <div className="flex gap-2">
                                {sprint.status === "planning" && (
                                  <Button size="sm" onClick={() => handleStartSprint(sprint.id)} className="flex-1">
                                    <Play className="h-4 w-4 mr-2" />
                                    Start Sprint
                                  </Button>
                                )}
                                {sprint.status === "active" && (
                                  <Button size="sm" onClick={() => handleCompleteSprint(sprint.id)} className="flex-1">
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Complete
                                  </Button>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          )
        })}
      </div>

      {sprints.length === 0 && (
        <Card className="p-12 text-center">
          <div className="text-slate-400 mb-4">
            <Calendar className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">No sprints yet</h3>
          <p className="text-slate-600 mb-4">Create your first sprint to start organizing your development work</p>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create First Sprint
          </Button>
        </Card>
      )}
    </div>
  )
}
