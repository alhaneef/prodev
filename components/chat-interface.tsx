"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Send,
  Bot,
  User,
  Code,
  Zap,
  CheckCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Terminal,
  Copy,
  Check,
  FileText,
  Play,
  Square,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"

interface Message {
  id: string
  role: "user" | "agent"
  content: string
  timestamp: string
  type?: "text" | "code" | "task" | "error" | "file_operation" | "terminal" | "markdown"
  metadata?: any
}

interface ChatInterfaceProps {
  projectId: string
  onUpdate?: (message: string, type: string) => void
}

export function ChatInterface({ projectId, onUpdate }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [agentStatus, setAgentStatus] = useState<"idle" | "thinking" | "working">("idle")
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [terminalOutput, setTerminalOutput] = useState<string[]>([])
  const [isTerminalActive, setIsTerminalActive] = useState(false)

  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadChatHistory()
    initializeWelcomeMessage()
  }, [projectId])

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [terminalOutput])

  const initializeWelcomeMessage = () => {
    const welcomeMessage: Message = {
      id: "welcome",
      role: "agent",
      content: `# Welcome to ProDev AI Agent! 🚀

I'm your intelligent development assistant with **full project access** and **advanced capabilities**:

## 🎯 Core Capabilities
- **Task Management**: Create, implement, and manage development tasks
- **Code Implementation**: Write, modify, and optimize code across your entire codebase  
- **Terminal Access**: Execute commands and interact with your development environment
- **File Operations**: Create, read, update, and delete files and directories
- **Project Deployment**: Deploy your applications to various platforms
- **Web Search**: Research solutions and best practices

## 🔧 Advanced Features
- **Contextual Memory**: I remember our entire conversation and project history
- **Codebase Intelligence**: Full understanding of your project structure and dependencies
- **Autonomous Implementation**: I can implement multiple tasks automatically
- **Real-time Collaboration**: Work alongside you with live updates

## 🚀 Quick Actions
Try these commands to get started:
- \`list files\` - Show all project files
- \`create task: [description]\` - Create a new development task
- \`implement all tasks\` - Automatically implement pending tasks
- \`run terminal command\` - Execute terminal commands
- \`deploy project\` - Deploy to production

**What would you like to work on today?**`,
      timestamp: new Date().toISOString(),
      type: "markdown",
    }
    setMessages([welcomeMessage])
  }

  const loadChatHistory = async () => {
    try {
      const response = await fetch(`/api/chat?projectId=${projectId}`, {
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.messages && data.messages.length > 0) {
          setMessages(data.messages)
        }
      }
    } catch (error) {
      console.error("Error loading chat history:", error)
    }
  }

  const saveChatHistory = async (newMessages: Message[]) => {
    try {
      await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId,
          messages: newMessages,
        }),
      })
    } catch (error) {
      console.error("Error saving chat history:", error)
    }
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: inputValue,
      timestamp: new Date().toISOString(),
      type: "text",
    }

    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInputValue("")
    setIsLoading(true)
    setAgentStatus("thinking")

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId,
          action: "chat",
          message: inputValue,
          conversationHistory: newMessages.slice(-10),
        }),
      })

      const data = await response.json()

      if (data.success) {
        const agentMessage: Message = {
          id: `msg_${Date.now()}_agent`,
          role: "agent",
          content: data.response,
          timestamp: new Date().toISOString(),
          type: data.response.includes("```") ? "markdown" : "text",
        }

        const finalMessages = [...newMessages, agentMessage]
        setMessages(finalMessages)
        await saveChatHistory(finalMessages)

        // Handle autonomous follow-up actions
        await handleAutonomousActions(data.response, finalMessages)

        onUpdate?.(data.response, "chat_response")
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error("Error sending message:", error)
      const errorMessage: Message = {
        id: `msg_${Date.now()}_error`,
        role: "agent",
        content: `❌ **Error**: ${error instanceof Error ? error.message : "Unknown error"}. Please check your configuration and try again.`,
        timestamp: new Date().toISOString(),
        type: "error",
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      setAgentStatus("idle")
    }
  }

  const handleAutonomousActions = async (agentResponse: string, currentMessages: Message[]) => {
    // Check for terminal commands
    if (agentResponse.includes("```bash") || agentResponse.includes("```sh")) {
      setIsTerminalActive(true)
      const commandMatch = agentResponse.match(/```(?:bash|sh)\n(.*?)\n```/s)
      if (commandMatch) {
        const command = commandMatch[1].trim()
        await executeTerminalCommand(command)
      }
    }

    // Check for file operations
    if (agentResponse.includes("```tool_code")) {
      setAgentStatus("working")
      const toolMatch = agentResponse.match(/```tool_code\n(.*?)\n```/s)
      if (toolMatch) {
        const toolCall = toolMatch[1]
        await executeToolCall(toolCall)
      }
    }

    // Check for task operations
    if (agentResponse.toLowerCase().includes("implement") && agentResponse.toLowerCase().includes("task")) {
      setAgentStatus("working")
      await handleTaskImplementation(agentResponse)
    }
  }

  const executeTerminalCommand = async (command: string) => {
    addTerminalOutput(`$ ${command}`)

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

      const data = await response.json()
      if (data.success) {
        addTerminalOutput(data.output)
      } else {
        addTerminalOutput(`Error: ${data.error}`)
      }
    } catch (error) {
      addTerminalOutput(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  const executeToolCall = async (toolCall: string) => {
    try {
      const response = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId,
          toolCall,
        }),
      })

      const data = await response.json()
      if (data.success) {
        const toolMessage: Message = {
          id: `msg_${Date.now()}_tool`,
          role: "agent",
          content: `**Tool Result:**\n\`\`\`\n${data.result}\n\`\`\``,
          timestamp: new Date().toISOString(),
          type: "markdown",
        }
        setMessages((prev) => [...prev, toolMessage])
      }
    } catch (error) {
      console.error("Error executing tool call:", error)
    } finally {
      setAgentStatus("idle")
    }
  }

  const handleTaskImplementation = async (response: string) => {
    // Extract task implementation requests
    if (response.toLowerCase().includes("implement all")) {
      await implementAllTasks()
    }
  }

  const implementAllTasks = async () => {
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId,
          action: "implement_all",
        }),
      })

      const data = await response.json()
      if (data.success) {
        const implementMessage: Message = {
          id: `msg_${Date.now()}_implement`,
          role: "agent",
          content: `✅ **Implementation Complete**\n\n- **Completed**: ${data.completed} tasks\n- **Failed**: ${data.failed} tasks\n\nAll pending tasks have been processed!`,
          timestamp: new Date().toISOString(),
          type: "markdown",
        }
        setMessages((prev) => [...prev, implementMessage])
        onUpdate?.("tasks_implemented", "implementation")
      }
    } catch (error) {
      console.error("Error implementing all tasks:", error)
    } finally {
      setAgentStatus("idle")
    }
  }

  const addTerminalOutput = (output: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setTerminalOutput((prev) => [...prev, `[${timestamp}] ${output}`])
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedCode(text)
      setTimeout(() => setCopiedCode(null), 2000)
    } catch (error) {
      console.error("Failed to copy:", error)
    }
  }

  const getMessageIcon = (message: Message) => {
    if (message.role === "user") return User

    switch (message.type) {
      case "code":
      case "markdown":
        return Code
      case "task":
        return CheckCircle
      case "error":
        return AlertCircle
      case "file_operation":
        return FileText
      case "terminal":
        return Terminal
      default:
        return Bot
    }
  }

  const getMessageBgColor = (message: Message) => {
    if (message.role === "user") return "bg-blue-50 border-blue-200"

    switch (message.type) {
      case "error":
        return "bg-red-50 border-red-200"
      case "task":
        return "bg-green-50 border-green-200"
      case "file_operation":
        return "bg-purple-50 border-purple-200"
      case "terminal":
        return "bg-gray-900 border-gray-700 text-green-400"
      default:
        return "bg-slate-50 border-slate-200"
    }
  }

  const renderMessageContent = (message: Message) => {
    if (message.type === "markdown" || message.content.includes("```")) {
      return (
        <ReactMarkdown
          className="prose prose-sm max-w-none"
          components={{
            code({ node, inline, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || "")
              const codeString = String(children).replace(/\n$/, "")

              if (!inline && match) {
                return (
                  <div className="relative">
                    <div className="flex items-center justify-between bg-gray-800 text-white px-4 py-2 rounded-t-md">
                      <span className="text-sm font-medium">{match[1]}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(codeString)}
                        className="h-6 w-6 p-0 text-white hover:bg-gray-700"
                      >
                        {copiedCode === codeString ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                    <SyntaxHighlighter
                      style={oneDark}
                      language={match[1]}
                      PreTag="div"
                      className="!mt-0 !rounded-t-none"
                      {...props}
                    >
                      {codeString}
                    </SyntaxHighlighter>
                  </div>
                )
              }

              return (
                <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono" {...props}>
                  {children}
                </code>
              )
            },
            h1: ({ children }) => <h1 className="text-xl font-bold mb-2">{children}</h1>,
            h2: ({ children }) => <h2 className="text-lg font-semibold mb-2">{children}</h2>,
            h3: ({ children }) => <h3 className="text-md font-medium mb-1">{children}</h3>,
            ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
            p: ({ children }) => <p className="mb-2">{children}</p>,
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-blue-500 pl-4 italic bg-blue-50 py-2 my-2">
                {children}
              </blockquote>
            ),
          }}
        >
          {message.content}
        </ReactMarkdown>
      )
    }

    return <div className="text-sm text-slate-700 whitespace-pre-wrap">{message.content}</div>
  }

  return (
    <div className="flex flex-col h-[700px]">
      {/* Header */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              ProDev AI Agent
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={agentStatus === "idle" ? "secondary" : "default"}>
                {agentStatus === "thinking" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                {agentStatus === "working" && <Zap className="h-3 w-3 mr-1" />}
                {agentStatus === "idle" && <CheckCircle className="h-3 w-3 mr-1" />}
                {agentStatus.charAt(0).toUpperCase() + agentStatus.slice(1)}
              </Badge>
              {isTerminalActive && (
                <Badge variant="outline" className="bg-gray-900 text-green-400">
                  <Terminal className="h-3 w-3 mr-1" />
                  Terminal Active
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Content */}
      <Card className="flex-1 flex flex-col">
        <Tabs defaultValue="chat" className="h-full">
          <CardHeader className="pb-2">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="terminal">Terminal</TabsTrigger>
            </TabsList>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col p-0">
            <TabsContent value="chat" className="flex-1 flex flex-col m-0">
              {/* Messages */}
              <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
                <div className="space-y-4">
                  {messages.map((message) => {
                    const MessageIcon = getMessageIcon(message)
                    return (
                      <div
                        key={message.id}
                        className={`flex gap-3 p-4 rounded-lg border ${getMessageBgColor(message)}`}
                      >
                        <div className="flex-shrink-0">
                          <div
                            className={`p-2 rounded-full ${message.role === "user" ? "bg-blue-100" : "bg-slate-100"}`}
                          >
                            <MessageIcon className="h-4 w-4" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{message.role === "user" ? "You" : "AI Agent"}</span>
                            <span className="text-xs text-slate-500">
                              {new Date(message.timestamp).toLocaleTimeString()}
                            </span>
                            {message.type && message.type !== "text" && (
                              <Badge variant="outline" className="text-xs">
                                {message.type.replace("_", " ")}
                              </Badge>
                            )}
                          </div>
                          {renderMessageContent(message)}
                          {message.metadata?.link && (
                            <div className="mt-2">
                              <Button variant="link" size="sm" className="p-0 h-auto text-xs">
                                <ExternalLink className="h-3 w-3 mr-1" />
                                View in{" "}
                                {message.metadata.link.replace("/", "").charAt(0).toUpperCase() +
                                  message.metadata.link.slice(2)}{" "}
                                tab
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {isLoading && (
                    <div className="flex gap-3 p-4 rounded-lg border bg-slate-50 border-slate-200">
                      <div className="flex-shrink-0">
                        <div className="p-2 rounded-full bg-slate-100">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="text-sm text-slate-600">AI Agent is thinking...</div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="border-t p-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Ask me anything, create tasks, implement features, run commands, or deploy your project..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={isLoading}
                    className="flex-1"
                  />
                  <Button onClick={handleSendMessage} disabled={!inputValue.trim() || isLoading} size="sm">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setInputValue("list all files in the project")}
                    disabled={isLoading}
                  >
                    List Files
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setInputValue("create a new task for implementing user authentication")}
                    disabled={isLoading}
                  >
                    Create Task
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setInputValue("implement all pending tasks")}
                    disabled={isLoading}
                  >
                    Implement All Tasks
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setInputValue("run terminal command: npm install")}
                    disabled={isLoading}
                  >
                    Run Command
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setInputValue("deploy the project to Vercel")}
                    disabled={isLoading}
                  >
                    Deploy Project
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="terminal" className="flex-1 flex flex-col m-0">
              <div className="flex-1 flex flex-col bg-gray-900 text-green-400">
                <div className="flex items-center justify-between p-3 border-b border-gray-700">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4" />
                    <span className="font-medium">Terminal</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTerminalOutput([])}
                      className="bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
                    >
                      Clear
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsTerminalActive(!isTerminalActive)}
                      className="bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
                    >
                      {isTerminalActive ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
                <ScrollArea className="flex-1 p-4 font-mono text-sm" ref={terminalRef}>
                  <div className="space-y-1">
                    {terminalOutput.map((line, index) => (
                      <div key={index} className="whitespace-pre-wrap">
                        {line}
                      </div>
                    ))}
                    {terminalOutput.length === 0 && (
                      <div className="text-gray-500">
                        Terminal ready. Use the chat to run commands or type them here.
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  )
}
