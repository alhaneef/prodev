"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Code,
  Play,
  Square,
  Terminal,
  FileText,
  Folder,
  FolderOpen,
  Search,
  RefreshCw,
  ExternalLink,
  Monitor,
  ChevronRight,
  ChevronDown,
} from "lucide-react"
import { WebContainerService } from "@/lib/webcontainer"

interface FileNode {
  name: string
  path: string
  type: "file" | "directory"
  children?: FileNode[]
  content?: string
  language?: string
  isExpanded?: boolean
}

interface WebContainerPreviewProps {
  projectId: string
}

export function WebContainerPreview({ projectId }: WebContainerPreviewProps) {
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isContainerReady, setIsContainerReady] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string>("")
  const [terminalOutput, setTerminalOutput] = useState<string[]>([])
  const [commandInput, setCommandInput] = useState("")
  const [isServerRunning, setIsServerRunning] = useState(false)

  const terminalRef = useRef<HTMLDivElement>(null)
  const webContainerService = WebContainerService.getInstance()

  useEffect(() => {
    initializeWebContainer()
    loadProjectFiles()
  }, [projectId])

  useEffect(() => {
    // Auto-scroll terminal
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [terminalOutput])

  const initializeWebContainer = async () => {
    try {
      setIsLoading(true)
      const manager = await webContainerService.getContainer(projectId)

      if (manager.isReady) {
        setIsContainerReady(true)
        addTerminalOutput("✅ WebContainer ready")
      } else {
        addTerminalOutput("🚀 Booting WebContainer...")
        // Wait for container to be ready
        const checkReady = setInterval(() => {
          if (manager.isReady) {
            setIsContainerReady(true)
            addTerminalOutput("✅ WebContainer ready")
            clearInterval(checkReady)
          }
        }, 1000)
      }
    } catch (error) {
      console.error("Failed to initialize WebContainer:", error)
      addTerminalOutput(
        `❌ Failed to initialize WebContainer: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
    } finally {
      setIsLoading(false)
    }
  }

  const loadProjectFiles = async () => {
    try {
      const response = await fetch(`/api/files?projectId=${projectId}&includeContent=false`, {
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          const processedTree = processFileTree(data.files)
          setFileTree(processedTree)

          // Mount files to WebContainer
          if (isContainerReady) {
            await mountFilesToContainer(data.files)
          }
        }
      }
    } catch (error) {
      console.error("Error loading project files:", error)
    }
  }

  const mountFilesToContainer = async (files: any[]) => {
    try {
      const fileStructure: Record<string, any> = {}

      for (const file of files) {
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

      await webContainerService.mountFiles(projectId, fileStructure)
      addTerminalOutput("📁 Project files mounted to WebContainer")
    } catch (error) {
      console.error("Error mounting files:", error)
      addTerminalOutput(`❌ Error mounting files: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  const setNestedProperty = (obj: any, path: string, value: any) => {
    const keys = path.split("/")
    let current = obj

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]
      if (!current[key]) {
        current[key] = { directory: {} }
      }
      current = current[key].directory
    }

    current[keys[keys.length - 1]] = value
  }

  const loadFileContent = async (filePath: string): Promise<string> => {
    try {
      const response = await fetch(`/api/files?projectId=${projectId}&filePath=${encodeURIComponent(filePath)}`, {
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        return data.content || ""
      }
    } catch (error) {
      console.error("Error loading file content:", error)
    }
    return ""
  }

  const processFileTree = (files: any[]): FileNode[] => {
    // Same processing logic as before
    const tree: FileNode[] = []
    const pathMap = new Map<string, FileNode>()

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
            isExpanded: i < 2,
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

  const addTerminalOutput = (output: string) => {
    setTerminalOutput((prev) => [...prev, `${new Date().toLocaleTimeString()} ${output}`])
  }

  const executeCommand = async () => {
    if (!commandInput.trim() || !isContainerReady) return

    const command = commandInput.trim()
    setCommandInput("")
    addTerminalOutput(`$ ${command}`)

    try {
      const [cmd, ...args] = command.split(" ")
      const process = await webContainerService.executeCommand(projectId, cmd, args)

      process.output.pipeTo(
        new WritableStream({
          write(data) {
            addTerminalOutput(data)
          },
        }),
      )

      const exitCode = await process.exit
      addTerminalOutput(`Process exited with code ${exitCode}`)

      // Special handling for dev server commands
      if (command.includes("dev") || command.includes("start")) {
        setIsServerRunning(true)
        const url = await webContainerService.startDevServer(projectId)
        setPreviewUrl(url)
        addTerminalOutput(`🌐 Dev server available at: ${url}`)
      }
    } catch (error) {
      addTerminalOutput(`❌ Command failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  const startDevServer = async () => {
    try {
      setIsServerRunning(true)
      addTerminalOutput("🚀 Starting development server...")

      const url = await webContainerService.startDevServer(projectId)
      setPreviewUrl(url)
      addTerminalOutput(`✅ Development server started: ${url}`)
    } catch (error) {
      setIsServerRunning(false)
      addTerminalOutput(`❌ Failed to start dev server: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  const stopDevServer = () => {
    setIsServerRunning(false)
    setPreviewUrl("")
    addTerminalOutput("⏹️ Development server stopped")
  }

  const syncWithGitHub = async () => {
    try {
      addTerminalOutput("🔄 Syncing changes with GitHub...")

      // Read all files from WebContainer and sync to GitHub
      const response = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId,
          action: "sync_from_webcontainer",
        }),
      })

      if (response.ok) {
        addTerminalOutput("✅ Successfully synced with GitHub")
      } else {
        addTerminalOutput("❌ Failed to sync with GitHub")
      }
    } catch (error) {
      addTerminalOutput(`❌ Sync error: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  const renderFileTree = (nodes: FileNode[], level = 0) => {
    return nodes.map((node) => (
      <div key={node.path}>
        <div
          className={`flex items-center gap-2 p-2 hover:bg-slate-100 cursor-pointer rounded ${
            selectedFile?.path === node.path ? "bg-blue-50 text-blue-700" : ""
          }`}
          style={{ marginLeft: `${level * 16}px` }}
          onClick={() => {
            if (node.type === "directory") {
              node.isExpanded = !node.isExpanded
              setFileTree([...fileTree])
            } else {
              setSelectedFile(node)
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
          <h2 className="text-2xl font-semibold text-slate-900">Development Environment</h2>
          <p className="text-slate-600">Full-featured development environment with WebContainer</p>
        </div>
        <div className="flex gap-2">
          <Badge variant={isContainerReady ? "default" : "secondary"}>{isContainerReady ? "Ready" : "Loading"}</Badge>
          <Button variant="outline" size="sm" onClick={syncWithGitHub}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync GitHub
          </Button>
          {!isServerRunning ? (
            <Button variant="outline" size="sm" onClick={startDevServer} disabled={!isContainerReady}>
              <Play className="h-4 w-4 mr-2" />
              Start Dev Server
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={stopDevServer}>
              <Square className="h-4 w-4 mr-2" />
              Stop Server
            </Button>
          )}
          {previewUrl && (
            <Button variant="outline" size="sm" onClick={() => window.open(previewUrl, "_blank")}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Preview
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[600px]">
        {/* File Tree */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Code className="h-4 w-4" />
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
            <ScrollArea className="h-[500px] px-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : (
                <div className="space-y-1">{renderFileTree(fileTree)}</div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Main Content Area */}
        <Card className="lg:col-span-3">
          <CardContent className="p-0 h-full">
            <Tabs defaultValue="editor" className="h-full">
              <div className="border-b px-4 py-2">
                <TabsList>
                  <TabsTrigger value="editor">
                    <Code className="h-4 w-4 mr-2" />
                    Editor
                  </TabsTrigger>
                  <TabsTrigger value="terminal">
                    <Terminal className="h-4 w-4 mr-2" />
                    Terminal
                  </TabsTrigger>
                  <TabsTrigger value="preview">
                    <Monitor className="h-4 w-4 mr-2" />
                    Preview
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="editor" className="h-[520px] m-0">
                <ScrollArea className="h-full p-4">
                  {selectedFile ? (
                    <div>
                      <div className="mb-4">
                        <h3 className="font-medium">{selectedFile.name}</h3>
                        <p className="text-sm text-slate-500">{selectedFile.path}</p>
                      </div>
                      <pre className="text-sm font-mono bg-slate-50 p-4 rounded overflow-x-auto">
                        <code>{selectedFile.content || "Loading..."}</code>
                      </pre>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-500">
                      <div className="text-center">
                        <Code className="h-12 w-12 mx-auto mb-4" />
                        <p className="text-lg font-medium mb-2">Select a file to edit</p>
                        <p className="text-sm">Choose a file from the tree to view and edit its contents</p>
                      </div>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="terminal" className="h-[520px] m-0">
                <div className="h-full flex flex-col">
                  <ScrollArea className="flex-1 p-4 bg-black text-green-400 font-mono text-sm" ref={terminalRef}>
                    {terminalOutput.map((line, index) => (
                      <div key={index} className="mb-1">
                        {line}
                      </div>
                    ))}
                  </ScrollArea>
                  <div className="border-t p-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter command..."
                        value={commandInput}
                        onChange={(e) => setCommandInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === "Enter") {
                            executeCommand()
                          }
                        }}
                        disabled={!isContainerReady}
                        className="font-mono"
                      />
                      <Button onClick={executeCommand} disabled={!isContainerReady || !commandInput.trim()}>
                        Run
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="preview" className="h-[520px] m-0">
                {previewUrl ? (
                  <iframe src={previewUrl} className="w-full h-full border-0" title="App Preview" />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500">
                    <div className="text-center">
                      <Monitor className="h-12 w-12 mx-auto mb-4" />
                      <p className="text-lg font-medium mb-2">No preview available</p>
                      <p className="text-sm mb-4">Start the development server to see your app</p>
                      <Button onClick={startDevServer} disabled={!isContainerReady}>
                        <Play className="h-4 w-4 mr-2" />
                        Start Dev Server
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
