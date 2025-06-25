"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import {
  RefreshCw,
  Terminal,
  FileText,
  Globe,
  Folder,
  File,
  ChevronRight,
  ChevronDown,
  Save,
  Search,
  FolderOpen,
  AlertTriangle,
} from "lucide-react"

interface FileNode {
  name: string
  type: "file" | "directory"
  path: string
  children?: FileNode[]
  content?: string
  size?: number
  lastModified?: string
}

interface WebContainerPreviewProps {
  projectId: string
}

export function WebContainerPreview({ projectId }: WebContainerPreviewProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isRunning, setIsRunning] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [files, setFiles] = useState<FileNode[]>([])
  const [allFiles, setAllFiles] = useState<any[]>([])
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null)
  const [fileContent, setFileContent] = useState("")
  const [terminalOutput, setTerminalOutput] = useState<string[]>([])
  const [commandInput, setCommandInput] = useState("")
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["src", "public", "components"]))
  const [searchQuery, setSearchQuery] = useState("")
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [containerError, setContainerError] = useState<string | null>(null)

  const terminalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadProjectFiles()
  }, [projectId])

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [terminalOutput])

  const loadProjectFiles = async () => {
    setIsLoading(true)
    addTerminalOutput("📂 Loading project files...")

    try {
      const response = await fetch(`/api/files?projectId=${projectId}&includeContent=false`, {
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        console.log("Files API response:", data)

        if (data.success) {
          const { files: rawFiles, fileTree, total, directories, regularFiles } = data

          setAllFiles(rawFiles || [])
          setFiles(fileTree || [])

          addTerminalOutput(
            `✅ Loaded ${total || 0} files (${directories || 0} directories, ${regularFiles || 0} files)`,
          )

          // Log detailed file structure
          if (rawFiles && rawFiles.length > 0) {
            addTerminalOutput("📁 File structure:")
            rawFiles.slice(0, 20).forEach((file: any, index: number) => {
              const icon = file.type === "dir" ? "📁" : "📄"
              const size = file.size ? `(${Math.round(file.size / 1024)}KB)` : ""
              addTerminalOutput(`  ${icon} ${file.path} ${size}`)
            })
            if (rawFiles.length > 20) {
              addTerminalOutput(`  ... and ${rawFiles.length - 20} more files`)
            }
          }
        } else {
          addTerminalOutput(`❌ Failed to load files: ${data.error || "Unknown error"}`)
          if (data.error) {
            setContainerError(data.error)
          }
        }
      } else {
        const errorText = await response.text()
        addTerminalOutput(`❌ Failed to load files: HTTP ${response.status} - ${errorText}`)
        setContainerError(`HTTP ${response.status}: ${errorText}`)
      }
    } catch (error) {
      console.error("Error loading project files:", error)
      addTerminalOutput(`❌ Error loading files: ${error instanceof Error ? error.message : "Unknown error"}`)
      setContainerError(error instanceof Error ? error.message : "Unknown error")
    } finally {
      setIsLoading(false)
    }
  }

  const loadFileContent = async (filePath: string): Promise<string> => {
    try {
      addTerminalOutput(`📖 Loading content for ${filePath}...`)

      const response = await fetch(`/api/files?projectId=${projectId}&filePath=${encodeURIComponent(filePath)}`, {
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          addTerminalOutput(`✅ Loaded ${filePath} (${data.content.length} characters)`)
          return data.content || ""
        } else {
          addTerminalOutput(`❌ Failed to load ${filePath}: ${data.error}`)
          return ""
        }
      } else {
        addTerminalOutput(`❌ Failed to load ${filePath}: HTTP ${response.status}`)
        return ""
      }
    } catch (error) {
      console.error("Error loading file content:", error)
      addTerminalOutput(`❌ Error loading ${filePath}: ${error instanceof Error ? error.message : "Unknown error"}`)
      return ""
    }
  }

  const saveFileContent = async (filePath: string, content: string) => {
    try {
      addTerminalOutput(`💾 Saving ${filePath}...`)

      const response = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId,
          action: "save",
          filePath,
          content,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setHasUnsavedChanges(false)
          addTerminalOutput(`✅ Saved ${filePath}`)
        } else {
          addTerminalOutput(`❌ Failed to save ${filePath}: ${data.error}`)
        }
      } else {
        addTerminalOutput(`❌ Failed to save ${filePath}: HTTP ${response.status}`)
      }
    } catch (error) {
      console.error("Error saving file:", error)
      addTerminalOutput(`❌ Error saving ${filePath}: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  const executeCommand = async () => {
    if (!commandInput.trim()) return

    const command = commandInput.trim()
    setCommandInput("")
    addTerminalOutput(`$ ${command}`)

    // Handle built-in commands
    if (command === "ls" || command === "dir") {
      addTerminalOutput("Files and directories:")
      allFiles.forEach((file, index) => {
        const icon = file.type === "dir" ? "📁" : "📄"
        const size = file.size ? `(${Math.round(file.size / 1024)}KB)` : ""
        addTerminalOutput(`${icon} ${file.name} ${size}`)
      })
      return
    }

    if (command === "ls -la" || command === "ls -l") {
      addTerminalOutput("Detailed file listing:")
      allFiles.forEach((file) => {
        const type = file.type === "dir" ? "d" : "-"
        const size = file.size || 0
        const date = file.lastModified ? new Date(file.lastModified).toLocaleDateString() : "unknown"
        addTerminalOutput(`${type}rwxr-xr-x 1 user user ${size.toString().padStart(8)} ${date} ${file.name}`)
      })
      return
    }

    if (command.startsWith("cat ") || command.startsWith("type ")) {
      const filePath = command.substring(4).trim()
      const content = await loadFileContent(filePath)
      if (content) {
        addTerminalOutput(`Content of ${filePath}:`)
        const lines = content.split("\n")
        lines.slice(0, 50).forEach((line) => addTerminalOutput(line))
        if (lines.length > 50) {
          addTerminalOutput(`... (${lines.length - 50} more lines)`)
        }
      } else {
        addTerminalOutput(`File not found or empty: ${filePath}`)
      }
      return
    }

    if (command.startsWith("find ")) {
      const searchTerm = command.substring(5).trim()
      const matchingFiles = allFiles.filter(
        (file) =>
          file.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
          file.name.toLowerCase().includes(searchTerm.toLowerCase()),
      )

      if (matchingFiles.length > 0) {
        addTerminalOutput(`Found ${matchingFiles.length} matching files:`)
        matchingFiles.forEach((file) => {
          const icon = file.type === "dir" ? "📁" : "📄"
          addTerminalOutput(`${icon} ${file.path}`)
        })
      } else {
        addTerminalOutput(`No files found matching: ${searchTerm}`)
      }
      return
    }

    if (command === "pwd") {
      addTerminalOutput(`/workspace/prodev-${projectId}`)
      return
    }

    if (command === "clear") {
      setTerminalOutput([])
      return
    }

    // Try to execute via terminal API
    try {
      const response = await fetch("/api/terminal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId,
          command,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          addTerminalOutput(data.output)
        } else {
          addTerminalOutput(`❌ Command failed: ${data.error}`)
        }
      } else {
        addTerminalOutput(`❌ Command failed: HTTP ${response.status}`)
      }
    } catch (error) {
      addTerminalOutput(`❌ Command failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  const addTerminalOutput = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setTerminalOutput((prev) => [...prev, `[${timestamp}] ${message}`])
  }

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(path)) {
        newSet.delete(path)
      } else {
        newSet.add(path)
      }
      return newSet
    })
  }

  const selectFile = async (file: FileNode) => {
    if (file.type === "file") {
      setSelectedFile(file)
      const content = await loadFileContent(file.path)
      setFileContent(content)
      setHasUnsavedChanges(false)
    }
  }

  const handleFileContentChange = (content: string) => {
    setFileContent(content)
    setHasUnsavedChanges(true)
  }

  const handleSaveFile = () => {
    if (selectedFile) {
      saveFileContent(selectedFile.path, fileContent)
    }
  }

  const filteredFiles = (nodes: FileNode[]): FileNode[] => {
    if (!searchQuery) return nodes

    return nodes.filter((node) => {
      if (node.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return true
      }
      if (node.children) {
        const filteredChildren = filteredFiles(node.children)
        return filteredChildren.length > 0
      }
      return false
    })
  }

  const renderFileTree = (nodes: FileNode[], level = 0) => {
    const filtered = filteredFiles(nodes)

    return filtered.map((node) => (
      <div key={node.path}>
        <div
          className={`flex items-center gap-2 py-1 px-2 hover:bg-slate-100 cursor-pointer rounded text-sm group ${
            selectedFile?.path === node.path ? "bg-blue-50 text-blue-700" : ""
          }`}
          style={{ marginLeft: `${level * 16}px` }}
          onClick={() => {
            if (node.type === "directory") {
              toggleFolder(node.path)
            } else {
              selectFile(node)
            }
          }}
        >
          {node.type === "directory" ? (
            <>
              {expandedFolders.has(node.path) ? (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-400" />
              )}
              {expandedFolders.has(node.path) ? (
                <FolderOpen className="h-4 w-4 text-blue-600" />
              ) : (
                <Folder className="h-4 w-4 text-blue-600" />
              )}
            </>
          ) : (
            <>
              <div className="w-4" />
              <File className="h-4 w-4 text-slate-600" />
            </>
          )}
          <span className="flex-1">{node.name}</span>
          {node.size && node.type === "file" && (
            <span className="text-xs text-slate-400">{Math.round(node.size / 1024)}KB</span>
          )}
        </div>
        {node.type === "directory" && expandedFolders.has(node.path) && node.children && (
          <div>{renderFileTree(node.children, level + 1)}</div>
        )}
      </div>
    ))
  }

  return (
    <div className="space-y-4">
      {/* Error Alert */}
      {containerError && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{containerError}</AlertDescription>
        </Alert>
      )}

      {/* Status Bar */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Development Environment
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Files: {allFiles.length}</Badge>
              <Badge variant={isRunning ? "default" : "secondary"}>{isRunning ? "Running" : "Stopped"}</Badge>
              <Button onClick={loadProjectFiles} variant="outline" size="sm" disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[700px]">
        {/* File Explorer */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Folder className="h-4 w-4" />
              Files ({allFiles.length})
            </CardTitle>
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[580px] px-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : files.length > 0 ? (
                <div className="space-y-1">{renderFileTree(files)}</div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No files found</p>
                  <Button onClick={loadProjectFiles} variant="outline" size="sm" className="mt-2">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reload
                  </Button>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Main Content Area */}
        <Card className="lg:col-span-3">
          <Tabs defaultValue="editor" className="h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                  <TabsTrigger value="editor">Editor</TabsTrigger>
                  <TabsTrigger value="terminal">Terminal</TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-2">
                  {selectedFile && hasUnsavedChanges && (
                    <Button onClick={handleSaveFile} size="sm">
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0 h-[580px]">
              <TabsContent value="editor" className="h-full m-0">
                {selectedFile ? (
                  <div className="h-full flex flex-col">
                    <div className="flex items-center gap-2 p-3 border-b bg-slate-50">
                      <FileText className="h-4 w-4" />
                      <span className="text-sm font-medium">{selectedFile.name}</span>
                      <span className="text-xs text-slate-500">{selectedFile.path}</span>
                      {hasUnsavedChanges && <Badge variant="secondary">Unsaved</Badge>}
                    </div>
                    <div className="flex-1">
                      <Textarea
                        value={fileContent}
                        onChange={(e) => handleFileContentChange(e.target.value)}
                        className="w-full h-full font-mono text-sm border-0 resize-none focus:outline-none rounded-none"
                        placeholder="File content..."
                        style={{ minHeight: "100%" }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500">
                    <div className="text-center">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">Select a file to edit</p>
                      <p className="text-sm">Choose a file from the explorer to view and edit its content</p>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="terminal" className="h-full m-0">
                <div className="h-full flex flex-col bg-black text-green-400">
                  <div className="flex items-center gap-2 p-3 border-b border-slate-700">
                    <Terminal className="h-4 w-4" />
                    <span className="font-medium">Terminal</span>
                    <Badge variant="outline">Interactive</Badge>
                  </div>
                  <ScrollArea className="flex-1 p-4 font-mono text-sm" ref={terminalRef}>
                    <div className="space-y-1">
                      {terminalOutput.map((line, index) => (
                        <div key={index}>{line}</div>
                      ))}
                      {terminalOutput.length === 0 && (
                        <div className="text-slate-500">
                          Terminal ready... Try 'ls' to see files, 'cat filename' to view content
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                  <div className="border-t border-slate-700 p-4">
                    <div className="flex gap-2">
                      <Input
                        value={commandInput}
                        onChange={(e) => setCommandInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === "Enter") {
                            executeCommand()
                          }
                        }}
                        placeholder="Enter command (ls, cat filename, find pattern, etc.)..."
                        className="bg-black border-slate-700 text-green-400 font-mono"
                      />
                      <Button onClick={executeCommand} disabled={!commandInput.trim()}>
                        Run
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  )
}
