"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Plus, Users, Mail, Settings, Crown, Shield, User, Search, Loader2 } from "lucide-react"
import { useAuth } from "@/components/auth-provider"

interface TeamMember {
  id: string
  name: string
  email: string
  role: "owner" | "admin" | "developer" | "viewer"
  avatar?: string
  joinedAt: string
  lastActive: string
  projectsAccess: number
  status: "active" | "invited" | "inactive"
}

export default function TeamPage() {
  const { user, loading } = useAuth()
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loadingTeam, setLoadingTeam] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filteredMembers, setFilteredMembers] = useState<TeamMember[]>([])

  useEffect(() => {
    if (user) {
      loadTeamMembers()
    }
  }, [user])

  useEffect(() => {
    filterMembers()
  }, [teamMembers, searchTerm])

  const loadTeamMembers = async () => {
    try {
      setLoadingTeam(true)
      // Simulate loading team data
      const mockTeamMembers: TeamMember[] = [
        {
          id: "1",
          name: "John Doe",
          email: user?.email || "john@example.com",
          role: "owner",
          avatar: "/placeholder.svg?height=40&width=40",
          joinedAt: "2024-01-15",
          lastActive: "2 minutes ago",
          projectsAccess: 12,
          status: "active",
        },
        {
          id: "2",
          name: "Sarah Wilson",
          email: "sarah@example.com",
          role: "admin",
          avatar: "/placeholder.svg?height=40&width=40",
          joinedAt: "2024-02-01",
          lastActive: "1 hour ago",
          projectsAccess: 8,
          status: "active",
        },
        {
          id: "3",
          name: "Mike Johnson",
          email: "mike@example.com",
          role: "developer",
          avatar: "/placeholder.svg?height=40&width=40",
          joinedAt: "2024-02-15",
          lastActive: "3 hours ago",
          projectsAccess: 5,
          status: "active",
        },
        {
          id: "4",
          name: "Emily Chen",
          email: "emily@example.com",
          role: "viewer",
          joinedAt: "2024-03-01",
          lastActive: "1 day ago",
          projectsAccess: 3,
          status: "invited",
        },
      ]
      setTeamMembers(mockTeamMembers)
    } catch (error) {
      console.error("Error loading team members:", error)
    } finally {
      setLoadingTeam(false)
    }
  }

  const filterMembers = () => {
    if (!searchTerm) {
      setFilteredMembers(teamMembers)
      return
    }

    const filtered = teamMembers.filter(
      (member) =>
        member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.role.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    setFilteredMembers(filtered)
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner":
        return Crown
      case "admin":
        return Shield
      case "developer":
        return User
      case "viewer":
        return User
      default:
        return User
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case "owner":
        return "bg-purple-100 text-purple-700"
      case "admin":
        return "bg-blue-100 text-blue-700"
      case "developer":
        return "bg-green-100 text-green-700"
      case "viewer":
        return "bg-gray-100 text-gray-700"
      default:
        return "bg-gray-100 text-gray-700"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-700"
      case "invited":
        return "bg-yellow-100 text-yellow-700"
      case "inactive":
        return "bg-red-100 text-red-700"
      default:
        return "bg-gray-100 text-gray-700"
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
          <p className="text-slate-600">Please log in to view team members.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Team</h1>
          <p className="text-slate-600">Manage your team members and permissions</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Invite Member
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamMembers.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <User className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamMembers.filter((m) => m.status === "active").length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Invites</CardTitle>
            <Mail className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamMembers.filter((m) => m.status === "invited").length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admins</CardTitle>
            <Shield className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {teamMembers.filter((m) => m.role === "admin" || m.role === "owner").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Search Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search by name, email, or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Team Members List */}
      {loadingTeam ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMembers.map((member) => {
            const RoleIcon = getRoleIcon(member.role)
            return (
              <Card key={member.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={member.avatar || "/placeholder.svg"} />
                        <AvatarFallback>
                          {member.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{member.name}</h3>
                        <p className="text-slate-600">{member.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className={getRoleColor(member.role)}>
                            <RoleIcon className="h-3 w-3 mr-1" />
                            {member.role}
                          </Badge>
                          <Badge variant="secondary" className={getStatusColor(member.status)}>
                            {member.status}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center gap-4 mb-2">
                        <div className="text-sm text-slate-500">
                          <p>Projects: {member.projectsAccess}</p>
                          <p>Joined: {new Date(member.joinedAt).toLocaleDateString()}</p>
                          <p>Last active: {member.lastActive}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Mail className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}

          {filteredMembers.length === 0 && teamMembers.length > 0 && (
            <div className="text-center py-12">
              <Search className="h-12 w-12 mx-auto text-slate-400 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No members found</h3>
              <p className="text-slate-600">Try adjusting your search criteria</p>
            </div>
          )}

          {teamMembers.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-slate-400 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No team members yet</h3>
              <p className="text-slate-600 mb-4">Invite your first team member to get started</p>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Invite Member
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
