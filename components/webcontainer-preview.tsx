"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
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
} from "lucide-react"

interface WebContainerPreviewProps {
  projectId: string
}

interface FileNode {
  name: string
  type: "file" | "directory"
  path: string
  children?: FileNode[]
  content?: string
}

export function WebContainerPreview({ projectId }: WebContainerPreviewProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isRunning, setIsRunning] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [files, setFiles] = useState<FileNode[]>([])
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null)
  const [terminalOutput, setTerminalOutput] = useState<string[]>([])
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  const iframeRef = useRef<HTMLIFrameElement>(null)
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
    try {
      setIsLoading(true)
      const response = await fetch(`/api/projects/${projectId}/files`)
      if (response.ok) {
        const data = await response.json()
        setFiles(data.files || [])
      }
    } catch (error) {
      console.error("Error loading project files:", error)
      addTerminalOutput("Error loading project files")
    } finally {
      setIsLoading(false)
    }
  }

  const startPreview = async () => {
    try {
      setIsRunning(true)
      addTerminalOutput("Starting development server...")

      const response = await fetch(`/api/projects/${projectId}/preview`, {
        method: "POST",
      })

      if (response.ok) {
        const data = await response.json()
        setPreviewUrl(data.url)
        addTerminalOutput(`Development server started at ${data.url}`)
      } else {
        addTerminalOutput("Failed to start development server")
        setIsRunning(false)
      }
    } catch (error) {
      console.error("Error starting preview:", error)
      addTerminalOutput("Error starting development server")
      setIsRunning(false)
    }
  }

  const stopPreview = async () => {
    try {
      await fetch(`/api/projects/${projectId}/preview`, {
        method: "DELETE",
      })
      setIsRunning(false)
      setPreviewUrl(null)
      addTerminalOutput("Development server stopped")
    } catch (error) {
      console.error("Error stopping preview:", error)
      addTerminalOutput("Error stopping development server")
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
      try {
        const response = await fetch(`/api/projects/${projectId}/files/${encodeURIComponent(file.path)}`)
        if (response.ok) {
          const data = await response.json()
          setSelectedFile({ ...file, content: data.content })
        }
      } catch (error) {
        console.error("Error loading file content:", error)
      }
    }
  }

  const renderFileTree = (nodes: FileNode[], level = 0) => {
    return nodes.map((node) => (
      <div key={node.path} style={{ marginLeft: `${level * 16}px` }}>
        <div
          className="flex items-center gap-2 py-1 px-2 hover:bg-slate-100 cursor-pointer rounded text-sm"
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
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <Folder className="h-4 w-4 text-blue-600" />
            </>
          ) : (
            <>
              <div className="w-4" />
              <File className="h-4 w-4 text-slate-600" />
            </>
          )}
          <span className={selectedFile?.path === node.path ? "font-medium text-blue-600" : ""}>{node.name}</span>
        </div>
        {node.type === "directory" && expandedFolders.has(node.path) && node.children && (
          <div>{renderFileTree(node.children, level + 1)}</div>
        )}
      </div>
    ))
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <RefreshCw className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Development Environment
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={isRunning ? "default" : "secondary"}>{isRunning ? "Running" : "Stopped"}</Badge>
              {!isRunning ? (
                <Button onClick={startPreview} size="sm">
                  <Play className="h-4 w-4 mr-2" />
                  Start
                </Button>
              ) : (
                <Button onClick={stopPreview} variant="outline" size="sm">
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[600px]">
        {/* File Explorer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Folder className="h-4 w-4" />
              Files
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px] p-4">
              {files.length > 0 ? renderFileTree(files) : <p className="text-sm text-slate-500">No files found</p>}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Code Editor / Preview */}
        <Card className="lg:col-span-2">
          <Tabs defaultValue="preview" className="h-full">
            <CardHeader className="pb-2">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="editor">Editor</TabsTrigger>
                <TabsTrigger value="terminal">Terminal</TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="p-0 h-[500px]">
              <TabsContent value="preview" className="h-full m-0">
                {previewUrl ? (
                  <iframe
                    ref={iframeRef}
                    src={previewUrl}
                    className="w-full h-full border-0 rounded-b-lg"
                    title="Preview"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500">
                    <div className="text-center">
                      <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Start the development server to see preview</p>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="editor" className="h-full m-0">
                {selectedFile ? (
                  <div className="h-full">
                    <div className="flex items-center gap-2 p-3 border-b bg-slate-50">
                      <FileText className="h-4 w-4" />
                      <span className="text-sm font-medium">{selectedFile.name}</span>
                    </div>
                    <ScrollArea className="h-[450px]">
                      <pre className="p-4 text-sm font-mono">
                        <code>{selectedFile.content || "Loading..."}</code>
                      </pre>
                    </ScrollArea>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500">
                    <div className="text-center">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Select a file to view its content</p>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="terminal" className="h-full m-0">
                <div className="h-full bg-black text-green-400 font-mono text-sm">
                  <div className="flex items-center gap-2 p-3 border-b border-slate-700">
                    <Terminal className="h-4 w-4" />
                    <span>Terminal</span>
                  </div>
                  <ScrollArea className="h-[450px]" ref={terminalRef}>
                    <div className="p-4 space-y-1">
                      {terminalOutput.map((line, index) => (
                        <div key={index}>{line}</div>
                      ))}
                      {terminalOutput.length === 0 && <div className="text-slate-500">Terminal ready...</div>}
                    </div>
                  </ScrollArea>
                </div>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  )
}
