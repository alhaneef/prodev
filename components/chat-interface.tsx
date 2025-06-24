"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Bot, User, Code, Zap, CheckCircle, AlertCircle, Loader2, ExternalLink } from "lucide-react"

interface Message {
  id: string
  role: "user" | "agent"
  content: string
  timestamp: string
  type?: "text" | "code" | "task" | "error" | "file_operation"
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
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadChatHistory()
    // Add welcome message if no history
    if (messages.length === 0) {
      const welcomeMessage: Message = {
        id: "welcome",
        role: "agent",
        content:
          "Hello! I'm your AI development agent with full project context and memory. I can help you:\n\n• Create and manage tasks and sprints\n• Implement features and fix bugs\n• Deploy your project\n• Search the web for information\n• Execute terminal commands (simulated)\n• Answer questions about your codebase\n\nWhat would you like to work on today?",
        timestamp: new Date().toISOString(),
        type: "text",
      }
      setMessages([welcomeMessage])
    }
  }, [projectId])

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [messages])

  const loadChatHistory = async () => {
    try {
      const response = await fetch(`/api/chat?projectId=${projectId}`, {
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.messages) {
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
          type: "text",
        }

        const finalMessages = [...newMessages, agentMessage]
        setMessages(finalMessages)
        await saveChatHistory(finalMessages)

        // Check if the user is requesting implementation or task management
        const lowerInput = inputValue.toLowerCase()
        if (
          lowerInput.includes("implement") ||
          lowerInput.includes("build") ||
          lowerInput.includes("create") ||
          lowerInput.includes("add") ||
          lowerInput.includes("task") ||
          lowerInput.includes("sprint")
        ) {
          setAgentStatus("working")
          await handleSpecialRequest(inputValue, finalMessages)
        }

        // Notify parent component of updates
        onUpdate?.(data.response, "chat_response")
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error("Error sending message:", error)
      const errorMessage: Message = {
        id: `msg_${Date.now()}_error`,
        role: "agent",
        content: `I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}. Please check your configuration and try again.`,
        timestamp: new Date().toISOString(),
        type: "error",
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      setAgentStatus("idle")
    }
  }

  const handleSpecialRequest = async (request: string, currentMessages: Message[]) => {
    try {
      // Check if it's a task creation request
      if (request.toLowerCase().includes("create task") || request.toLowerCase().includes("add task")) {
        const taskCreationMessage: Message = {
          id: `msg_${Date.now()}_task_creation`,
          role: "agent",
          content: "I'm creating a new task based on your request...",
          timestamp: new Date().toISOString(),
          type: "task",
          metadata: {
            action: "creating_task",
            status: "in_progress",
          },
        }

        const updatedMessages = [...currentMessages, taskCreationMessage]
        setMessages(updatedMessages)

        // Simulate task creation (you would call the actual API here)
        setTimeout(() => {
          const completionMessage: Message = {
            id: `msg_${Date.now()}_task_complete`,
            role: "agent",
            content: "✅ Task created successfully! You can view it in the Tasks tab.",
            timestamp: new Date().toISOString(),
            type: "task",
            metadata: {
              action: "task_created",
              status: "completed",
              link: "/tasks",
            },
          }

          setMessages((prev) => [...prev, completionMessage])
          onUpdate?.("task_created", "task_created")
        }, 2000)
      }

      // Check if it's an implementation request
      if (
        request.toLowerCase().includes("implement") ||
        request.toLowerCase().includes("build") ||
        request.toLowerCase().includes("code")
      ) {
        const implementationMessage: Message = {
          id: `msg_${Date.now()}_implementation`,
          role: "agent",
          content: "🔨 Starting implementation... I'll work on this and update the code files.",
          timestamp: new Date().toISOString(),
          type: "file_operation",
          metadata: {
            action: "implementing",
            status: "in_progress",
          },
        }

        const updatedMessages = [...currentMessages, implementationMessage]
        setMessages(updatedMessages)

        // Simulate file operations
        const fileOperations = [
          "Creating component structure...",
          "Adding TypeScript types...",
          "Implementing core functionality...",
          "Adding error handling...",
          "Writing tests...",
          "Updating documentation...",
        ]

        for (let i = 0; i < fileOperations.length; i++) {
          setTimeout(
            () => {
              const operationMessage: Message = {
                id: `msg_${Date.now()}_operation_${i}`,
                role: "agent",
                content: `📝 ${fileOperations[i]}`,
                timestamp: new Date().toISOString(),
                type: "file_operation",
                metadata: {
                  action: "file_operation",
                  step: i + 1,
                  total: fileOperations.length,
                },
              }

              setMessages((prev) => [...prev, operationMessage])

              // Final completion message
              if (i === fileOperations.length - 1) {
                setTimeout(() => {
                  const completionMessage: Message = {
                    id: `msg_${Date.now()}_impl_complete`,
                    role: "agent",
                    content: "✅ Implementation completed! Check the Code tab to see the changes.",
                    timestamp: new Date().toISOString(),
                    type: "file_operation",
                    metadata: {
                      action: "implementation_completed",
                      status: "completed",
                      link: "/code",
                    },
                  }

                  setMessages((prev) => [...prev, completionMessage])
                  onUpdate?.("implementation_completed", "implementation_completed")
                }, 1000)
              }
            },
            (i + 1) * 1500,
          )
        }
      }
    } catch (error) {
      console.error("Error handling special request:", error)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const getMessageIcon = (message: Message) => {
    if (message.role === "user") return User

    switch (message.type) {
      case "code":
        return Code
      case "task":
        return CheckCircle
      case "error":
        return AlertCircle
      case "file_operation":
        return Code
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
      default:
        return "bg-slate-50 border-slate-200"
    }
  }

  return (
    <div className="flex flex-col h-[600px]">
      {/* Header */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              AI Development Agent
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={agentStatus === "idle" ? "secondary" : "default"}>
                {agentStatus === "thinking" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                {agentStatus === "working" && <Zap className="h-3 w-3 mr-1" />}
                {agentStatus === "idle" && <CheckCircle className="h-3 w-3 mr-1" />}
                {agentStatus.charAt(0).toUpperCase() + agentStatus.slice(1)}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Messages */}
      <Card className="flex-1 flex flex-col">
        <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((message) => {
              const MessageIcon = getMessageIcon(message)
              return (
                <div key={message.id} className={`flex gap-3 p-4 rounded-lg border ${getMessageBgColor(message)}`}>
                  <div className="flex-shrink-0">
                    <div className={`p-2 rounded-full ${message.role === "user" ? "bg-blue-100" : "bg-slate-100"}`}>
                      <MessageIcon className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{message.role === "user" ? "You" : "AI Agent"}</span>
                      <span className="text-xs text-slate-500">{new Date(message.timestamp).toLocaleTimeString()}</span>
                      {message.type && message.type !== "text" && (
                        <Badge variant="outline" className="text-xs">
                          {message.type.replace("_", " ")}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-slate-700 whitespace-pre-wrap">{message.content}</div>
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
                    {message.metadata?.step && (
                      <div className="mt-2 text-xs text-slate-500">
                        Step {message.metadata.step} of {message.metadata.total}
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
        <CardContent className="border-t p-4">
          <div className="flex gap-2">
            <Input
              placeholder="Ask me anything, create tasks, implement features, or deploy your project..."
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
          <div className="flex gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInputValue("Create a new task for implementing user authentication")}
              disabled={isLoading}
            >
              Create Task
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInputValue("Implement the next priority task")}
              disabled={isLoading}
            >
              Implement Next Task
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInputValue("Deploy the project to Vercel")}
              disabled={isLoading}
            >
              Deploy Project
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInputValue("Search for React best practices")}
              disabled={isLoading}
            >
              Web Search
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
