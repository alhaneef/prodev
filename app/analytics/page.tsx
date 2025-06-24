"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart3, TrendingUp, Clock, Zap, CheckCircle, GitCommit, Loader2 } from "lucide-react"
import { useAuth } from "@/components/auth-provider"

export default function AnalyticsPage() {
  const { user, loading } = useAuth()
  const [analytics, setAnalytics] = useState<any>(null)
  const [loadingAnalytics, setLoadingAnalytics] = useState(true)
  const [timeRange, setTimeRange] = useState("7d")

  useEffect(() => {
    if (user) {
      loadAnalytics()
    }
  }, [user, timeRange])

  const loadAnalytics = async () => {
    try {
      setLoadingAnalytics(true)
      // Simulate loading analytics data
      const mockAnalytics = {
        overview: {
          totalProjects: 12,
          activeProjects: 8,
          completedTasks: 156,
          deployments: 24,
          codeGenerated: "45.2k",
          efficiency: 94,
        },
        productivity: {
          tasksPerDay: [
            { day: "Mon", tasks: 12 },
            { day: "Tue", tasks: 18 },
            { day: "Wed", tasks: 15 },
            { day: "Thu", tasks: 22 },
            { day: "Fri", tasks: 19 },
            { day: "Sat", tasks: 8 },
            { day: "Sun", tasks: 5 },
          ],
          avgTaskTime: "2.4h",
          successRate: 96,
        },
        agents: {
          totalAgents: 4,
          activeAgents: 3,
          totalUptime: "99.2%",
          tasksCompleted: 156,
          performance: [
            { name: "Code Generator", efficiency: 94, tasks: 62 },
            { name: "Task Manager", efficiency: 87, tasks: 45 },
            { name: "Deployment", efficiency: 96, tasks: 28 },
            { name: "QA Tester", efficiency: 91, tasks: 21 },
          ],
        },
        projects: {
          byFramework: [
            { framework: "Next.js", count: 5, percentage: 42 },
            { framework: "React", count: 3, percentage: 25 },
            { framework: "Vue.js", count: 2, percentage: 17 },
            { framework: "Python", count: 2, percentage: 16 },
          ],
          byStatus: [
            { status: "Active", count: 8, percentage: 67 },
            { status: "Completed", count: 3, percentage: 25 },
            { status: "Paused", count: 1, percentage: 8 },
          ],
        },
      }
      setAnalytics(mockAnalytics)
    } catch (error) {
      console.error("Error loading analytics:", error)
    } finally {
      setLoadingAnalytics(false)
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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-600">Please log in to view analytics.</p>
        </div>
      </div>
    )
  }

  if (loadingAnalytics) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Analytics</h1>
          <p className="text-slate-600">Track your development progress and AI agent performance</p>
        </div>
        <div className="flex gap-2">
          {["7d", "30d", "90d"].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 text-sm rounded-md ${
                timeRange === range ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {range === "7d" ? "7 Days" : range === "30d" ? "30 Days" : "90 Days"}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projects</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.overview.totalProjects}</div>
            <p className="text-xs text-muted-foreground">{analytics?.overview.activeProjects} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasks</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.overview.completedTasks}</div>
            <p className="text-xs text-muted-foreground">completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deployments</CardTitle>
            <Zap className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.overview.deployments}</div>
            <p className="text-xs text-muted-foreground">successful</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Code Generated</CardTitle>
            <GitCommit className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.overview.codeGenerated}</div>
            <p className="text-xs text-muted-foreground">lines</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Efficiency</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.overview.efficiency}%</div>
            <p className="text-xs text-muted-foreground">avg rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Task Time</CardTitle>
            <Clock className="h-4 w-4 text-cyan-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.productivity.avgTaskTime}</div>
            <p className="text-xs text-muted-foreground">per task</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="productivity" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="productivity">Productivity</TabsTrigger>
          <TabsTrigger value="agents">AI Agents</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="productivity" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Daily Task Completion</CardTitle>
                <CardDescription>Tasks completed per day over the last week</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics?.productivity.tasksPerDay.map((day: any) => (
                    <div key={day.day} className="flex items-center gap-4">
                      <div className="w-12 text-sm font-medium">{day.day}</div>
                      <div className="flex-1">
                        <Progress value={(day.tasks / 25) * 100} className="h-2" />
                      </div>
                      <div className="w-8 text-sm text-right">{day.tasks}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Success Metrics</CardTitle>
                <CardDescription>Overall development success rates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span>Task Success Rate</span>
                    <span>{analytics?.productivity.successRate}%</span>
                  </div>
                  <Progress value={analytics?.productivity.successRate} className="h-2" />
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span>Deployment Success</span>
                    <span>98%</span>
                  </div>
                  <Progress value={98} className="h-2" />
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span>Code Quality</span>
                    <span>92%</span>
                  </div>
                  <Progress value={92} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="agents" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Agent Performance</CardTitle>
                <CardDescription>Efficiency and task completion by agent</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {analytics?.agents.performance.map((agent: any) => (
                  <div key={agent.name} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{agent.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{agent.tasks} tasks</Badge>
                        <span>{agent.efficiency}%</span>
                      </div>
                    </div>
                    <Progress value={agent.efficiency} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Agent Status</CardTitle>
                <CardDescription>Current status and uptime</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{analytics?.agents.totalAgents}</p>
                    <p className="text-sm text-slate-600">Total Agents</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">{analytics?.agents.activeAgents}</p>
                    <p className="text-sm text-slate-600">Active</p>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-600">{analytics?.agents.totalUptime}</p>
                  <p className="text-sm text-slate-600">Total Uptime</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="projects" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Projects by Framework</CardTitle>
                <CardDescription>Distribution of projects by technology</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {analytics?.projects.byFramework.map((item: any) => (
                  <div key={item.framework} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{item.framework}</span>
                      <div className="flex items-center gap-2">
                        <span>{item.count} projects</span>
                        <span>{item.percentage}%</span>
                      </div>
                    </div>
                    <Progress value={item.percentage} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Projects by Status</CardTitle>
                <CardDescription>Current status distribution</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {analytics?.projects.byStatus.map((item: any) => (
                  <div key={item.status} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{item.status}</span>
                      <div className="flex items-center gap-2">
                        <span>{item.count} projects</span>
                        <span>{item.percentage}%</span>
                      </div>
                    </div>
                    <Progress value={item.percentage} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Response Times</CardTitle>
                <CardDescription>Average response times</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">API Calls</span>
                  <span className="text-sm font-medium">245ms</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Code Generation</span>
                  <span className="text-sm font-medium">1.2s</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Deployments</span>
                  <span className="text-sm font-medium">45s</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resource Usage</CardTitle>
                <CardDescription>Current resource consumption</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span>CPU Usage</span>
                    <span>34%</span>
                  </div>
                  <Progress value={34} className="h-2" />
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span>Memory</span>
                    <span>67%</span>
                  </div>
                  <Progress value={67} className="h-2" />
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span>Storage</span>
                    <span>23%</span>
                  </div>
                  <Progress value={23} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Error Rates</CardTitle>
                <CardDescription>System error tracking</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-600">99.8%</p>
                  <p className="text-sm text-slate-600">Success Rate</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>API Errors</span>
                    <span className="text-red-600">0.1%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Deploy Failures</span>
                    <span className="text-red-600">0.1%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
