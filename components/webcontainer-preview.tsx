"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
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
} from "lucide-react"
import { WebContainer } from "@webcontainer/api"

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

  const webContainerRef = useRef<WebContainer | null>(null)
  const terminalRef = useRef<HTMLDivElement>(null)
  const fileCache = useRef<Map<string, { content: string; lastModified: string }>>(new Map())

  useEffect(() => {
    initializeWebContainer()
    loadProjectFiles()
    loadCacheFromStorage()

    // Set up periodic cache refresh
    const cacheRefreshInterval = setInterval(() => {
      refreshFileCache()
    }, 30000) // Refresh every 30 seconds

    return () => {
      clearInterval(cacheRefreshInterval)
      cleanupWebContainer()
    }
  }, [projectId])

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [terminalOutput])

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

  const initializeWebContainer = async () => {
    try {
      addTerminalOutput("🚀 Initializing WebContainer...")
      webContainerRef.current = await WebContainer.boot()
      setIsContainerReady(true)
      addTerminalOutput("✅ WebContainer ready")
    } catch (error) {
      console.error("Failed to initialize WebContainer:", error)
      addTerminalOutput(
        `❌ WebContainer initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
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

          // Mount files to WebContainer
          if (isContainerReady && webContainerRef.current) {
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
    if (!webContainerRef.current) return

    try {
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

      await webContainerRef.current.mount(fileStructure)
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
      const response = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId,
          action: "update",
          filePath,
          content,
        }),
      })

      if (response.ok) {
        // Update cache
        fileCache.current.set(filePath, {
          content,
          lastModified: new Date().toISOString(),
        })
        saveCacheToStorage()

        // Update WebContainer
        if (webContainerRef.current) {
          await webContainerRef.current.fs.writeFile(filePath, content)
        }

        setHasUnsavedChanges(false)
        addTerminalOutput(`💾 Saved ${filePath}`)
      } else {
        addTerminalOutput(`❌ Failed to save ${filePath}`)
      }
    } catch (error) {
      console.error("Error saving file:", error)
      addTerminalOutput(`❌ Error saving ${filePath}: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  const refreshFileCache = async () => {
    try {
      // Refresh file list and update cache
      await loadProjectFiles()
    } catch (error) {
      console.error("Error refreshing cache:", error)
    }
  }

  const startDevServer = async () => {
    if (!webContainerRef.current || !isContainerReady) {
      addTerminalOutput("❌ WebContainer not ready")
      return
    }

    try {
      setIsRunning(true)
      addTerminalOutput("🚀 Installing dependencies...")

      // Install dependencies
      const installProcess = await webContainerRef.current.spawn("npm", ["install"])
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
      const devProcess = await webContainerRef.current.spawn("npm", ["run", "dev"])
      devProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            addTerminalOutput(data)
          },
        }),
      )

      // Listen for server ready event
      webContainerRef.current.on("server-ready", (port, url) => {
        setPreviewUrl(url)
        addTerminalOutput(`✅ Development server ready at ${url}`)
      })
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
    if (!commandInput.trim() || !webContainerRef.current) return

    const command = commandInput.trim()
    setCommandInput("")
    addTerminalOutput(`$ ${command}`)

    try {
      const [cmd, ...args] = command.split(" ")
      const process = await webContainerRef.current.spawn(cmd, args)

      process.output.pipeTo(
        new WritableStream({
          write(data) {
            addTerminalOutput(data)
          },
        }),
      )

      const exitCode = await process.exit
      addTerminalOutput(`Process exited with code ${exitCode}`)
    } catch (error) {
      addTerminalOutput(`❌ Command failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  const cleanupWebContainer = () => {
    if (webContainerRef.current) {
      webContainerRef.current.teardown()
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
          className={`flex items-center gap-2 py-1 px-2 hover:bg-slate-100 cursor-pointer rounded text-sm ${
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
      {/* Status Bar */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Development Environment
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={isContainerReady ? "default" : "secondary"}>
                {isContainerReady ? "Ready" : "Loading"}
              </Badge>
              <Badge variant={isRunning ? "default" : "secondary"}>{isRunning ? "Running" : "Stopped"}</Badge>
              <Button onClick={refreshFileCache} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              {!isRunning ? (
                <Button onClick={startDevServer} size="sm" disabled={!isContainerReady}>
                  <Play className="h-4 w-4 mr-2" />
                  Start Dev
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
                {selectedFile && hasUnsavedChanges && (
                  <Button onClick={handleSaveFile} size="sm">
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-0 h-[580px]">
              <TabsContent value="editor" className="h-full m-0">
                {selectedFile ? (
                  <div className="h-full flex flex-col">
                    <div className="flex items-center gap-2 p-3 border-b bg-slate-50">
                      <FileText className="h-4 w-4" />
                      <span className="text-sm font-medium">{selectedFile.name}</span>
                      {hasUnsavedChanges && <Badge variant="secondary">Unsaved</Badge>}
                    </div>
                    <div className="flex-1">
                      <textarea
                        value={fileContent}
                        onChange={(e) => handleFileContentChange(e.target.value)}
                        className="w-full h-full p-4 font-mono text-sm border-0 resize-none focus:outline-none"
                        placeholder="File content..."
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
                      <p className="text-sm mb-4">Start the development server to see your app</p>
                      <Button onClick={startDevServer} disabled={!isContainerReady}>
                        <Play className="h-4 w-4 mr-2" />
                        Start Development Server
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
                  </div>
                  <ScrollArea className="flex-1 p-4 font-mono text-sm" ref={terminalRef}>
                    <div className="space-y-1">
                      {terminalOutput.map((line, index) => (
                        <div key={index}>{line}</div>
                      ))}
                      {terminalOutput.length === 0 && (
                        <div className="text-slate-500">WebContainer terminal ready...</div>
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
                        placeholder="Enter command..."
                        className="bg-black border-slate-700 text-green-400 font-mono"
                        disabled={!isContainerReady}
                      />
                      <Button onClick={executeCommand} disabled={!isContainerReady || !commandInput.trim()}>
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
