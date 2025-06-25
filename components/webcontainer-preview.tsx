"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import {
  Play,
  Square,
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
  ExternalLink,
  Plus,
  Trash2,
} from "lucide-react"
import { WebContainerManager } from "@/lib/webcontainer-service"

interface WebContainerPreviewProps {
  projectId: string
}

interface FileNode {
  name: string
  type: "file" | "directory"
  path: string
  children?: FileNode[]
  content?: string
  size?: number
  lastModified?: string
}

export function WebContainerPreview({ projectId }: WebContainerPreviewProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isContainerReady, setIsContainerReady] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [files, setFiles] = useState<FileNode[]>([])
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null)
  const [fileContent, setFileContent] = useState("")
  const [terminalOutput, setTerminalOutput] = useState<string[]>([])
  const [commandInput, setCommandInput] = useState("")
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["src", "public", "components"]))
  const [searchQuery, setSearchQuery] = useState("")
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [containerError, setContainerError] = useState<string | null>(null)
  const [useWebContainer, setUseWebContainer] = useState(true)
  const [sessionStats, setSessionStats] = useState<any>(null)

  const webContainerManager = WebContainerManager.getInstance()
  const terminalRef = useRef<HTMLDivElement>(null)
  const fileCache = useRef<Map<string, { content: string; lastModified: string; hash: string }>>(new Map())
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSyncHash = useRef<string>("")

  useEffect(() => {
    initializeEnvironment()
    loadProjectFiles()
    loadCacheFromStorage()

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
      }
      webContainerManager.destroySession(projectId)
    }
  }, [projectId])

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [terminalOutput])

  const initializeEnvironment = async () => {
    // Check if WebContainer is supported
    if (!crossOriginIsolated) {
      setContainerError("WebContainer requires Cross-Origin Isolation. Using fallback mode.")
      setUseWebContainer(false)
      addTerminalOutput("⚠️ WebContainer not available, using fallback mode")
      return
    }

    try {
      addTerminalOutput("🚀 Initializing WebContainer...")
      const session = await webContainerManager.getSession(projectId)

      if (session.isReady) {
        setIsContainerReady(true)
        addTerminalOutput("✅ WebContainer ready")
        updateSessionStats()
      } else {
        // Wait for container to be ready
        const checkReady = setInterval(() => {
          if (session.isReady) {
            setIsContainerReady(true)
            addTerminalOutput("✅ WebContainer ready")
            updateSessionStats()
            clearInterval(checkReady)
          }
        }, 1000)

        // Timeout after 30 seconds
        setTimeout(() => {
          clearInterval(checkReady)
          if (!session.isReady) {
            setContainerError("WebContainer initialization timeout. Using fallback mode.")
            setUseWebContainer(false)
            addTerminalOutput("⚠️ WebContainer timeout, switching to fallback mode")
          }
        }, 30000)
      }
    } catch (error) {
      console.error("Failed to initialize WebContainer:", error)
      setContainerError(`WebContainer failed: ${error instanceof Error ? error.message : "Unknown error"}`)
      setUseWebContainer(false)
      addTerminalOutput(`❌ WebContainer failed: ${error instanceof Error ? error.message : "Unknown error"}`)
      addTerminalOutput("🔄 Switching to fallback mode")
    }
  }

  const updateSessionStats = () => {
    const stats = webContainerManager.getSessionStats()
    setSessionStats(stats)
  }

  const loadCacheFromStorage = () => {
    try {
      const cached = localStorage.getItem(`prodev_files_${projectId}`)
      if (cached) {
        const parsedCache = JSON.parse(cached)
        fileCache.current = new Map(Object.entries(parsedCache))
        addTerminalOutput("📁 Loaded file cache from storage")
      }
    } catch (error) {
      console.error("Error loading cache:", error)
    }
  }

  const saveCacheToStorage = () => {
    try {
      const cacheObj = Object.fromEntries(fileCache.current)
      localStorage.setItem(`prodev_files_${projectId}`, JSON.stringify(cacheObj))
    } catch (error) {
      console.error("Error saving cache:", error)
    }
  }

  const generateContentHash = (content: string): string => {
    // Simple hash function for change detection
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString()
  }

  const scheduleSync = useCallback(() => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current)
    }

    syncTimeoutRef.current = setTimeout(() => {
      syncChangesIfNeeded()
    }, 2000) // Sync after 2 seconds of inactivity
  }, [])

  const syncChangesIfNeeded = async () => {
    try {
      // Generate current state hash
      const currentFiles = Array.from(fileCache.current.entries())
      const currentHash = generateContentHash(JSON.stringify(currentFiles))

      if (currentHash === lastSyncHash.current) {
        return // No changes to sync
      }

      addTerminalOutput("🔄 Syncing changes...")

      // Sync to GitHub
      const response = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId,
          action: "bulk_update",
          files: currentFiles.map(([path, data]) => ({
            path,
            content: data.content,
          })),
        }),
      })

      if (response.ok) {
        lastSyncHash.current = currentHash
        addTerminalOutput("✅ Changes synced to GitHub")
      } else {
        addTerminalOutput("❌ Failed to sync changes")
      }
    } catch (error) {
      console.error("Error syncing changes:", error)
      addTerminalOutput(`❌ Sync error: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  const loadProjectFiles = async () => {
    try {
      setIsLoading(true)
      addTerminalOutput("📂 Loading project files...")

      const response = await fetch(`/api/files?projectId=${projectId}&includeContent=false`, {
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.files) {
          const processedFiles = buildFileTree(data.files)
          setFiles(processedFiles)
          addTerminalOutput(`✅ Loaded ${data.files.length} files`)

          // Mount files to WebContainer if available
          if (useWebContainer && isContainerReady) {
            await mountFilesToWebContainer(data.files)
          }
        } else {
          addTerminalOutput("❌ Failed to load files: " + (data.error || "Unknown error"))
        }
      } else {
        addTerminalOutput(`❌ Failed to load files: HTTP ${response.status}`)
      }
    } catch (error) {
      console.error("Error loading project files:", error)
      addTerminalOutput(`❌ Error loading files: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsLoading(false)
    }
  }

  const buildFileTree = (fileList: any[]): FileNode[] => {
    const tree: FileNode[] = []
    const pathMap = new Map<string, FileNode>()

    // Sort files to ensure directories come before their contents
    fileList.sort((a, b) => {
      if (a.type === "dir" && b.type === "file") return -1
      if (a.type === "file" && b.type === "dir") return 1
      return a.path.localeCompare(b.path)
    })

    for (const file of fileList) {
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

  const mountFilesToWebContainer = async (fileList: any[]) => {
    if (!useWebContainer) return

    try {
      const session = await webContainerManager.getSession(projectId)
      if (!session.container) return

      addTerminalOutput("🔧 Mounting files to WebContainer...")
      const fileStructure: Record<string, any> = {}

      for (const file of fileList) {
        if (file.type === "file") {
          const content = await loadFileContent(file.path)
          setNestedProperty(fileStructure, file.path, {
            file: {
              contents: content,
            },
          })
        } else {
          setNestedProperty(fileStructure, file.path, {
            directory: {},
          })
        }
      }

      await session.container.mount(fileStructure)
      addTerminalOutput("✅ Files mounted to WebContainer")
    } catch (error) {
      console.error("Error mounting files:", error)
      addTerminalOutput(`❌ Error mounting files: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  const setNestedProperty = (obj: any, path: string, value: any) => {
    const keys = path.split("/").filter(Boolean)
    let current = obj

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]
      if (!current[key]) {
        current[key] = { directory: {} }
      }
      current = current[key].directory || current[key]
    }

    const lastKey = keys[keys.length - 1]
    current[lastKey] = value
  }

  const loadFileContent = async (filePath: string): Promise<string> => {
    // Check cache first
    const cached = fileCache.current.get(filePath)
    if (cached) {
      return cached.content
    }

    try {
      const response = await fetch(`/api/files?projectId=${projectId}&filePath=${encodeURIComponent(filePath)}`, {
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        const content = data.content || ""

        // Update cache
        fileCache.current.set(filePath, {
          content,
          lastModified: new Date().toISOString(),
          hash: generateContentHash(content),
        })
        saveCacheToStorage()

        return content
      }
    } catch (error) {
      console.error("Error loading file content:", error)
    }
    return ""
  }

  const saveFileContent = async (filePath: string, content: string) => {
    try {
      // Update cache immediately
      fileCache.current.set(filePath, {
        content,
        lastModified: new Date().toISOString(),
        hash: generateContentHash(content),
      })
      saveCacheToStorage()

      // Update WebContainer if available
      if (useWebContainer && isContainerReady) {
        try {
          const session = await webContainerManager.getSession(projectId)
          if (session.container) {
            await session.container.fs.writeFile(filePath, content)
            webContainerManager.updateActivity(projectId)
          }
        } catch (error) {
          console.error("Error updating WebContainer file:", error)
        }
      }

      setHasUnsavedChanges(false)
      addTerminalOutput(`💾 Saved ${filePath}`)

      // Schedule sync
      scheduleSync()
    } catch (error) {
      console.error("Error saving file:", error)
      addTerminalOutput(`❌ Error saving ${filePath}: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  const createNewFile = async (parentPath: string, fileName: string, isDirectory = false) => {
    const fullPath = parentPath ? `${parentPath}/${fileName}` : fileName

    try {
      if (isDirectory) {
        // Create directory
        const response = await fetch("/api/files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            projectId,
            action: "create_directory",
            filePath: fullPath,
          }),
        })

        if (response.ok) {
          addTerminalOutput(`📁 Created directory: ${fullPath}`)
          await loadProjectFiles() // Refresh file tree
        }
      } else {
        // Create file
        await saveFileContent(fullPath, "")
        addTerminalOutput(`📄 Created file: ${fullPath}`)
        await loadProjectFiles() // Refresh file tree
      }
    } catch (error) {
      addTerminalOutput(
        `❌ Error creating ${isDirectory ? "directory" : "file"}: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
    }
  }

  const deleteFile = async (filePath: string) => {
    try {
      const response = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId,
          action: "delete",
          filePath,
        }),
      })

      if (response.ok) {
        // Remove from cache
        fileCache.current.delete(filePath)
        saveCacheToStorage()

        addTerminalOutput(`🗑️ Deleted: ${filePath}`)
        await loadProjectFiles() // Refresh file tree

        // Clear selected file if it was deleted
        if (selectedFile?.path === filePath) {
          setSelectedFile(null)
          setFileContent("")
        }
      }
    } catch (error) {
      addTerminalOutput(`❌ Error deleting file: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  const startDevServer = async () => {
    if (!useWebContainer) {
      // Fallback: Open GitHub Codespaces or similar
      addTerminalOutput("🌐 Opening external development environment...")
      const githubUrl = `https://github.com/codespaces/new?repo=${projectId}`
      window.open(githubUrl, "_blank")
      return
    }

    try {
      const session = await webContainerManager.getSession(projectId)
      if (!session.container) {
        addTerminalOutput("❌ WebContainer not available")
        return
      }

      setIsRunning(true)
      addTerminalOutput("🚀 Installing dependencies...")

      // Install dependencies
      const installProcess = await session.container.spawn("npm", ["install"])
      installProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            addTerminalOutput(data)
          },
        }),
      )

      const installExitCode = await installProcess.exit
      if (installExitCode !== 0) {
        addTerminalOutput(`❌ npm install failed with exit code ${installExitCode}`)
        setIsRunning(false)
        return
      }

      addTerminalOutput("✅ Dependencies installed")
      addTerminalOutput("🚀 Starting development server...")

      // Start dev server
      const devProcess = await session.container.spawn("npm", ["run", "dev"])
      devProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            addTerminalOutput(data)
          },
        }),
      )

      // Listen for server ready event
      session.container.on("server-ready", (port, url) => {
        setPreviewUrl(url)
        addTerminalOutput(`✅ Development server ready at ${url}`)
      })

      webContainerManager.updateActivity(projectId)
    } catch (error) {
      console.error("Error starting dev server:", error)
      addTerminalOutput(`❌ Failed to start dev server: ${error instanceof Error ? error.message : "Unknown error"}`)
      setIsRunning(false)
    }
  }

  const stopDevServer = () => {
    setIsRunning(false)
    setPreviewUrl(null)
    addTerminalOutput("⏹️ Development server stopped")
  }

  const executeCommand = async () => {
    if (!commandInput.trim()) return

    const command = commandInput.trim()
    setCommandInput("")
    addTerminalOutput(`$ ${command}`)

    // Handle special commands
    if (command === "ls" || command === "dir") {
      const fileList = Object.keys(fileCache.current)
      addTerminalOutput("Files and directories:")
      fileList.forEach((file, index) => {
        addTerminalOutput(`${index + 1}. ${file}`)
      })
      return
    }

    if (command.startsWith("cat ")) {
      const filePath = command.substring(4).trim()
      const content = await loadFileContent(filePath)
      if (content) {
        addTerminalOutput(`Content of ${filePath}:`)
        addTerminalOutput(content.substring(0, 500) + (content.length > 500 ? "..." : ""))
      } else {
        addTerminalOutput(`File not found: ${filePath}`)
      }
      return
    }

    if (!useWebContainer) {
      addTerminalOutput("❌ Terminal not available in fallback mode")
      return
    }

    try {
      const session = await webContainerManager.getSession(projectId)
      if (!session.container) {
        addTerminalOutput("❌ WebContainer not available")
        return
      }

      const [cmd, ...args] = command.split(" ")
      const process = await session.container.spawn(cmd, args)

      process.output.pipeTo(
        new WritableStream({
          write(data) {
            addTerminalOutput(data)
          },
        }),
      )

      const exitCode = await process.exit
      addTerminalOutput(`Process exited with code ${exitCode}`)

      webContainerManager.updateActivity(projectId)
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

          {/* File actions */}
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
            {node.type === "directory" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation()
                  const fileName = prompt("Enter file name:")
                  if (fileName) {
                    createNewFile(node.path, fileName)
                  }
                }}
              >
                <Plus className="h-3 w-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation()
                if (confirm(`Delete ${node.name}?`)) {
                  deleteFile(node.path)
                }
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
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
              {!useWebContainer && <Badge variant="outline">Fallback Mode</Badge>}
            </CardTitle>
            <div className="flex items-center gap-2">
              {sessionStats && (
                <Badge variant="outline">
                  Sessions: {sessionStats.active}/{sessionStats.limit}
                </Badge>
              )}
              <Badge variant={isContainerReady ? "default" : "secondary"}>
                {isContainerReady ? "Ready" : "Loading"}
              </Badge>
              <Badge variant={isRunning ? "default" : "secondary"}>{isRunning ? "Running" : "Stopped"}</Badge>
              <Button onClick={loadProjectFiles} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              {!isRunning ? (
                <Button onClick={startDevServer} size="sm">
                  <Play className="h-4 w-4 mr-2" />
                  {useWebContainer ? "Start Dev" : "Open External"}
                </Button>
              ) : (
                <Button onClick={stopDevServer} variant="outline" size="sm">
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              )}
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
              Files
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
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const fileName = prompt("Enter file name:")
                    if (fileName) {
                      createNewFile("", fileName)
                    }
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  File
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const folderName = prompt("Enter folder name:")
                    if (folderName) {
                      createNewFile("", folderName, true)
                    }
                  }}
                >
                  <Folder className="h-3 w-3 mr-1" />
                  Folder
                </Button>
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
                <TabsList className="grid w-full max-w-md grid-cols-3">
                  <TabsTrigger value="editor">Editor</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                  <TabsTrigger value="terminal">Terminal</TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-2">
                  {selectedFile && hasUnsavedChanges && (
                    <Button onClick={handleSaveFile} size="sm">
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                  )}
                  {previewUrl && (
                    <Button variant="outline" size="sm" onClick={() => window.open(previewUrl, "_blank")}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open
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

              <TabsContent value="preview" className="h-full m-0">
                {previewUrl ? (
                  <iframe src={previewUrl} className="w-full h-full border-0" title="App Preview" />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500">
                    <div className="text-center">
                      <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">No preview available</p>
                      <p className="text-sm mb-4">
                        {useWebContainer
                          ? "Start the development server to see your app"
                          : "Use external development environment for preview"}
                      </p>
                      <Button onClick={startDevServer}>
                        <Play className="h-4 w-4 mr-2" />
                        {useWebContainer ? "Start Development Server" : "Open External Environment"}
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="terminal" className="h-full m-0">
                <div className="h-full flex flex-col bg-black text-green-400">
                  <div className="flex items-center gap-2 p-3 border-b border-slate-700">
                    <Terminal className="h-4 w-4" />
                    <span className="font-medium">Terminal</span>
                    {!useWebContainer && <Badge variant="outline">Limited</Badge>}
                  </div>
                  <ScrollArea className="flex-1 p-4 font-mono text-sm" ref={terminalRef}>
                    <div className="space-y-1">
                      {terminalOutput.map((line, index) => (
                        <div key={index}>{line}</div>
                      ))}
                      {terminalOutput.length === 0 && (
                        <div className="text-slate-500">
                          {useWebContainer
                            ? "WebContainer terminal ready... Try 'ls' to see files"
                            : "Terminal not available in fallback mode"}
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
                        placeholder={
                          useWebContainer ? "Enter command (try 'ls', 'cat filename')..." : "Terminal not available"
                        }
                        className="bg-black border-slate-700 text-green-400 font-mono"
                        disabled={!useWebContainer && !commandInput.startsWith("ls") && !commandInput.startsWith("cat")}
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
