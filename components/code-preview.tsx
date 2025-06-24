"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import {
  Code,
  Eye,
  Download,
  GitBranch,
  RefreshCw,
  ExternalLink,
  FileText,
  Folder,
  FolderOpen,
  Search,
  Lock,
  Unlock,
  Edit,
  Save,
  X,
  Play,
  ChevronRight,
  ChevronDown,
} from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface FileNode {
  name: string
  path: string
  type: "file" | "directory"
  children?: FileNode[]
  content?: string
  language?: string
  isProtected?: boolean
  isReadOnly?: boolean
  size?: number
  lastModified?: string
  isExpanded?: boolean
}

interface CodePreviewProps {
  projectId: string
}

interface LiveUpdate {
  type: "file_created" | "file_updated" | "file_deleted" | "folder_created"
  path: string
  content?: string
  timestamp: string
  message: string
}

export function CodePreview({ projectId }: CodePreviewProps) {
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState("")
  const [liveUpdates, setLiveUpdates] = useState<LiveUpdate[]>([])
  const [showLiveUpdates, setShowLiveUpdates] = useState(true)
  const liveUpdatesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadProjectFiles()
    // Set up live updates polling
    const interval = setInterval(checkForLiveUpdates, 2000)
    return () => clearInterval(interval)
  }, [projectId])

  useEffect(() => {
    // Auto-scroll live updates
    if (liveUpdatesRef.current) {
      liveUpdatesRef.current.scrollTop = liveUpdatesRef.current.scrollHeight
    }
  }, [liveUpdates])

  const loadProjectFiles = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/files?projectId=${projectId}&includeContent=false`, {
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          const processedTree = processFileTree(data.files)
          setFileTree(processedTree)

          // Auto-select first file
          const firstFile = findFirstFile(processedTree)
          if (firstFile) {
            loadFileContent(firstFile)
          }
        }
      }
    } catch (error) {
      console.error("Error loading project files:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const processFileTree = (files: any[]): FileNode[] => {
    const tree: FileNode[] = []
    const pathMap = new Map<string, FileNode>()

    // Sort files to ensure directories come before their contents
    files.sort((a, b) => {
      if (a.type === "dir" && b.type === "file") return -1
      if (a.type === "file" && b.type === "dir") return 1
      return a.path.localeCompare(b.path)
    })

    for (const file of files) {
      const pathParts = file.path.split("/").filter(Boolean)
      let currentPath = ""
      let currentLevel = tree

      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i]
        currentPath = currentPath ? `${currentPath}/${part}` : part

        let node = pathMap.get(currentPath)

        if (!node) {
          const isLastPart = i === pathParts.length - 1
          const isFile = isLastPart && file.type === "file"

          node = {
            name: part,
            path: currentPath,
            type: isFile ? "file" : "directory",
            children: isFile ? undefined : [],
            size: file.size,
            lastModified: file.lastModified,
            isExpanded: i < 2, // Auto-expand first 2 levels
          }

          pathMap.set(currentPath, node)
          currentLevel.push(node)
        }

        if (node.children) {
          currentLevel = node.children
        }
      }
    }

    return tree
  }

  const checkForLiveUpdates = async () => {
    try {
      const response = await fetch(`/api/files/live-updates?projectId=${projectId}&since=${Date.now() - 10000}`, {
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.updates.length > 0) {
          setLiveUpdates((prev) => [...prev, ...data.updates].slice(-20)) // Keep last 20 updates

          // Refresh file tree if there are structural changes
          const hasStructuralChanges = data.updates.some(
            (update: LiveUpdate) =>
              update.type === "file_created" || update.type === "file_deleted" || update.type === "folder_created",
          )

          if (hasStructuralChanges) {
            await loadProjectFiles()
          }

          // Refresh current file if it was updated
          if (selectedFile && data.updates.some((update: LiveUpdate) => update.path === selectedFile.path)) {
            await loadFileContent(selectedFile)
          }
        }
      }
    } catch (error) {
      console.error("Error checking live updates:", error)
    }
  }

  const findFirstFile = (tree: FileNode[]): FileNode | null => {
    for (const node of tree) {
      if (node.type === "file") return node
      if (node.children) {
        const found = findFirstFile(node.children)
        if (found) return found
      }
    }
    return null
  }

  const loadFileContent = async (file: FileNode) => {
    if (file.type === "directory") return

    try {
      const response = await fetch(`/api/files?projectId=${projectId}&filePath=${encodeURIComponent(file.path)}`, {
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          file.content = data.content
          file.isProtected = data.isProtected
          file.isReadOnly = data.isReadOnly
          setSelectedFile({ ...file })
          setEditContent(data.content)
        }
      }
    } catch (error) {
      console.error("Error loading file content:", error)
      file.content = `Error loading file: ${error instanceof Error ? error.message : "Unknown error"}`
      setSelectedFile({ ...file })
    }
  }

  const saveFileContent = async () => {
    if (!selectedFile || selectedFile.isReadOnly) return

    try {
      const response = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId,
          action: "update",
          filePath: selectedFile.path,
          content: editContent,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          selectedFile.content = editContent
          setSelectedFile({ ...selectedFile })
          setIsEditing(false)
        }
      }
    } catch (error) {
      console.error("Error saving file:", error)
    }
  }

  const toggleFolder = (node: FileNode) => {
    const updateTree = (tree: FileNode[]): FileNode[] => {
      return tree.map((item) => {
        if (item.path === node.path) {
          return { ...item, isExpanded: !item.isExpanded }
        }
        if (item.children) {
          return { ...item, children: updateTree(item.children) }
        }
        return item
      })
    }

    setFileTree(updateTree(fileTree))
  }

  const toggleFileProtection = async (file: FileNode) => {
    try {
      const response = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId,
          action: "protect",
          filePath: file.path,
          isProtected: !file.isProtected,
        }),
      })

      if (response.ok) {
        file.isProtected = !file.isProtected
        setSelectedFile({ ...file })
      }
    } catch (error) {
      console.error("Error toggling file protection:", error)
    }
  }

  const getLanguageFromExtension = (filename: string): string => {
    const ext = filename.split(".").pop()?.toLowerCase()
    const languageMap: Record<string, string> = {
      js: "javascript",
      jsx: "javascript",
      ts: "typescript",
      tsx: "typescript",
      py: "python",
      html: "html",
      css: "css",
      scss: "scss",
      json: "json",
      md: "markdown",
      yml: "yaml",
      yaml: "yaml",
      xml: "xml",
      sql: "sql",
      sh: "bash",
      dockerfile: "dockerfile",
    }
    return languageMap[ext || ""] || "text"
  }

  const filterFiles = (nodes: FileNode[], query: string): FileNode[] => {
    if (!query) return nodes

    return nodes
      .filter((node) => {
        if (node.name.toLowerCase().includes(query.toLowerCase())) {
          return true
        }
        if (node.children) {
          const filteredChildren = filterFiles(node.children, query)
          return filteredChildren.length > 0
        }
        return false
      })
      .map((node) => ({
        ...node,
        children: node.children ? filterFiles(node.children, query) : undefined,
      }))
  }

  const renderFileTree = (nodes: FileNode[], level = 0) => {
    const filteredNodes = filterFiles(nodes, searchQuery)

    return filteredNodes.map((node) => (
      <div key={node.path}>
        <div
          className={`flex items-center gap-2 p-2 hover:bg-slate-100 cursor-pointer rounded ${
            selectedFile?.path === node.path ? "bg-blue-50 text-blue-700" : ""
          }`}
          style={{ marginLeft: `${level * 16}px` }}
          onClick={() => {
            if (node.type === "directory") {
              toggleFolder(node)
            } else {
              loadFileContent(node)
            }
          }}
        >
          {node.type === "directory" ? (
            <div className="flex items-center gap-1">
              {node.isExpanded ? (
                <ChevronDown className="h-3 w-3 text-slate-400" />
              ) : (
                <ChevronRight className="h-3 w-3 text-slate-400" />
              )}
              {node.isExpanded ? (
                <FolderOpen className="h-4 w-4 text-blue-600" />
              ) : (
                <Folder className="h-4 w-4 text-blue-600" />
              )}
            </div>
          ) : (
            <FileText className="h-4 w-4 text-slate-600 ml-4" />
          )}
          <span className="text-sm flex-1">{node.name}</span>
          {node.type === "file" && (
            <>
              <Badge variant="outline" className="text-xs">
                {getLanguageFromExtension(node.name)}
              </Badge>
              {node.isProtected && <Lock className="h-3 w-3 text-orange-500" />}
              {node.isReadOnly && <Eye className="h-3 w-3 text-gray-500" />}
            </>
          )}
        </div>
        {node.type === "directory" && node.children && node.isExpanded && renderFileTree(node.children, level + 1)}
      </div>
    ))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Code Preview</h2>
          <p className="text-slate-600">View and manage your project files</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadProjectFiles} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </div>

      {/* Live Updates Panel */}
      {showLiveUpdates && liveUpdates.length > 0 && (
        <Alert>
          <Play className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">Live Updates</span>
              <Button variant="ghost" size="sm" onClick={() => setShowLiveUpdates(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div ref={liveUpdatesRef} className="max-h-20 overflow-y-auto space-y-1">
              {liveUpdates.slice(-3).map((update, index) => (
                <div key={index} className="text-xs text-slate-600">
                  <span className="font-mono">{update.path}</span> - {update.message}
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[600px]">
        {/* File Tree */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <GitBranch className="h-4 w-4" />
              Project Files
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px] px-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : fileTree.length > 0 ? (
                <div className="space-y-1">{renderFileTree(fileTree)}</div>
              ) : (
                <div className="text-center text-slate-500 py-8">
                  <FileText className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">No files found</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Code Editor */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Code className="h-4 w-4" />
                {selectedFile ? selectedFile.name : "Select a file"}
              </CardTitle>
              {selectedFile && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{getLanguageFromExtension(selectedFile.name)}</Badge>
                  {selectedFile.type === "file" && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => toggleFileProtection(selectedFile)}>
                        {selectedFile.isProtected ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                      </Button>
                      {!selectedFile.isReadOnly && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (isEditing) {
                              saveFileContent()
                            } else {
                              setIsEditing(true)
                            }
                          }}
                        >
                          {isEditing ? <Save className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                        </Button>
                      )}
                      {isEditing && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setIsEditing(false)
                            setEditContent(selectedFile.content || "")
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  )}
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {selectedFile?.content ? (
                isEditing ? (
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="min-h-[500px] font-mono text-sm border-0 resize-none"
                    placeholder="Enter your code here..."
                  />
                ) : (
                  <pre className="p-4 text-sm font-mono bg-slate-50 overflow-x-auto">
                    <code className={`language-${getLanguageFromExtension(selectedFile.name)}`}>
                      {selectedFile.content}
                    </code>
                  </pre>
                )
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500">
                  <div className="text-center">
                    <Code className="h-12 w-12 mx-auto mb-4" />
                    <p className="text-lg font-medium mb-2">No file selected</p>
                    <p className="text-sm">Select a file from the tree to view its contents</p>
                  </div>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
