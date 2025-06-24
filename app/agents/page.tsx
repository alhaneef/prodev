"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Bot, Zap, CheckCircle, Play, Pause, Settings, Activity, Code, Loader2 } from "lucide-react"
import { useAuth } from "@/components/auth-provider"

interface Agent {
  id: string
  name: string
  type: "code-generator" | "task-manager" | "deployment" | "qa-tester"
  status: "active" | "idle" | "working" | "paused"
  currentTask?: string
  projectId?: string
  projectName?: string
  tasksCompleted: number
  efficiency: number
  uptime: string
}

export default function AgentsPage() {
  const { user, loading } = useAuth()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loadingAgents, setLoadingAgents] = useState(true)
  const [activeTab, setActiveTab] = useState("overview")

  useEffect(() => {
    if (user) {
      loadAgents()
    }
  }, [user])

  const loadAgents = async () => {
    try {
      setLoadingAgents(true)
      // Simulate loading agents data
      const mockAgents: Agent[] = [
        {
          id: "agent_1",
          name: "Code Generator Alpha",
          type: "code-generator",
          status: "working",
          currentTask: "Implementing user authentication system",
          projectId: "proj_1",
          projectName: "E-commerce Dashboard",
          tasksCompleted: 24,
          efficiency: 94,
          uptime: "99.8%",
        },
        {
          id: "agent_2",
          name: "Task Manager Beta",
          type: "task-manager",
          status: "active",
          currentTask: "Analyzing project requirements",
          projectId: "proj_2",
          projectName: "Blog Platform",
          tasksCompleted: 18,
          efficiency: 87,
          uptime: "98.5%",
        },
        {
          id: "agent_3",
          name: "Deployment Specialist",
          type: "deployment",
          status: "idle",
          tasksCompleted: 12,
          efficiency: 96,
          uptime: "99.9%",
        },
        {
          id: "agent_4",
          name: "QA Tester Gamma",
          type: "qa-tester",
          status: "paused",
          tasksCompleted: 8,
          efficiency: 91,
          uptime: "97.2%",
        },
      ]
      setAgents(mockAgents)
    } catch (error) {
      console.error("Error loading agents:", error)
    } finally {
      setLoadingAgents(false)
    }
  }

  const getAgentIcon = (type: string) => {
    switch (type) {
      case "code-generator":
        return Code
      case "task-manager":
        return CheckCircle
      case "deployment":
        return Zap
      case "qa-tester":
        return Activity
      default:
        return Bot
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-700"
      case "working":
        return "bg-blue-100 text-blue-700"
      case "idle":
        return "bg-gray-100 text-gray-700"
      case "paused":
        return "bg-yellow-100 text-yellow-700"
      default:
        return "bg-gray-100 text-gray-700"
    }
  }

  const toggleAgentStatus = (agentId: string) => {
    setAgents((prev) =>
      prev.map((agent) =>
        agent.id === agentId
          ? {
              ...agent,
              status: agent.status === "paused" ? "active" : "paused",
            }
          : agent,
      ),
    )
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
          <p className="text-slate-600">Please log in to view AI agents.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">AI Agents</h1>
          <p className="text-slate-600">Monitor and manage your AI development agents</p>
        </div>
        <Button>
          <Bot className="w-4 h-4 mr-2" />
          Deploy New Agent
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agents.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Zap className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {agents.filter((a) => a.status === "active" || a.status === "working").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasks Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agents.reduce((acc, agent) => acc + agent.tasksCompleted, 0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Efficiency</CardTitle>
            <Activity className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(agents.reduce((acc, agent) => acc + agent.efficiency, 0) / agents.length)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="logs">Activity Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {loadingAgents ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {agents.map((agent) => {
                const AgentIcon = getAgentIcon(agent.type)
                return (
                  <Card key={agent.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <AgentIcon className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{agent.name}</CardTitle>
                            <CardDescription className="capitalize">{agent.type.replace("-", " ")}</CardDescription>
                          </div>
                        </div>
                        <Badge variant="secondary" className={getStatusColor(agent.status)}>
                          {agent.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {agent.currentTask && (
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm font-medium text-blue-900">Current Task</p>
                          <p className="text-sm text-blue-700">{agent.currentTask}</p>
                          {agent.projectName && (
                            <p className="text-xs text-blue-600 mt-1">Project: {agent.projectName}</p>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-2xl font-bold text-slate-900">{agent.tasksCompleted}</p>
                          <p className="text-xs text-slate-500">Tasks Done</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-slate-900">{agent.efficiency}%</p>
                          <p className="text-xs text-slate-500">Efficiency</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-slate-900">{agent.uptime}</p>
                          <p className="text-xs text-slate-500">Uptime</p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleAgentStatus(agent.id)}
                          className="flex-1"
                        >
                          {agent.status === "paused" ? (
                            <>
                              <Play className="h-4 w-4 mr-2" />
                              Resume
                            </>
                          ) : (
                            <>
                              <Pause className="h-4 w-4 mr-2" />
                              Pause
                            </>
                          )}
                        </Button>
                        <Button variant="outline" size="sm">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Agent Performance</CardTitle>
                <CardDescription>Efficiency metrics for each agent</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {agents.map((agent) => (
                  <div key={agent.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{agent.name}</span>
                      <span>{agent.efficiency}%</span>
                    </div>
                    <Progress value={agent.efficiency} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Task Completion</CardTitle>
                <CardDescription>Tasks completed by each agent</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {agents.map((agent) => (
                  <div key={agent.id} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{agent.name}</span>
                    <Badge variant="outline">{agent.tasksCompleted} tasks</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="logs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest actions performed by AI agents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  {
                    time: "2 minutes ago",
                    agent: "Code Generator Alpha",
                    action: "Completed user authentication implementation",
                    status: "success",
                  },
                  {
                    time: "15 minutes ago",
                    agent: "Task Manager Beta",
                    action: "Generated 5 new tasks for Blog Platform project",
                    status: "success",
                  },
                  {
                    time: "1 hour ago",
                    agent: "Deployment Specialist",
                    action: "Successfully deployed E-commerce Dashboard to Vercel",
                    status: "success",
                  },
                  {
                    time: "2 hours ago",
                    agent: "QA Tester Gamma",
                    action: "Found 3 issues in payment integration",
                    status: "warning",
                  },
                ].map((log, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
                    <div
                      className={`w-2 h-2 rounded-full mt-2 ${
                        log.status === "success" ? "bg-green-500" : "bg-yellow-500"
                      }`}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">{log.action}</p>
                      <p className="text-xs text-slate-500">
                        {log.agent} • {log.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
