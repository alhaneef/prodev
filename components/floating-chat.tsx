"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageCircle, X, Minimize2, Maximize2, Send, Bot, User, Reply, Loader2, Zap, CheckCircle } from "lucide-react"

interface Message {
  id: string
  role: "user" | "agent"
  content: string
  timestamp: string
  type?: "text" | "code" | "task" | "error" | "file_operation"
  metadata?: any
  replyTo?: string
}

interface FloatingChatProps {
  projectId: string
  projectName: string
  onUpdate?: (message: string, type: string) => void
}

export function FloatingChat({ projectId, projectName, onUpdate }: FloatingChatProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [agentStatus, setAgentStatus] = useState<"idle" | "thinking" | "working">("idle")
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)

  useEffect(() => {
    if (isOpen) {
      loadChatHistory()
    }
  }, [isOpen, projectId])

  // Restore scroll position
  useEffect(() => {
    if (isOpen && scrollAreaRef.current && messages.length > 0) {
      const savedPosition = localStorage.getItem(`chat-scroll-${projectId}`)
      if (savedPosition && !shouldAutoScroll) {
        setTimeout(() => {
          if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTop = Number.parseInt(savedPosition)
          }
        }, 100)
      }
    }
  }, [isOpen, projectId, messages.length])

  // Handle scroll events
  useEffect(() => {
    const scrollArea = scrollAreaRef.current
    if (scrollArea) {
      const handleScroll = () => {
        const position = scrollArea.scrollTop
        const maxScroll = scrollArea.scrollHeight - scrollArea.clientHeight

        // Save scroll position
        localStorage.setItem(`chat-scroll-${projectId}`, position.toString())

        // Determine if user is near bottom (within 100px)
        setShouldAutoScroll(maxScroll - position < 100)
      }

      scrollArea.addEventListener("scroll", handleScroll)
      return () => scrollArea.removeEventListener("scroll", handleScroll)
    }
  }, [projectId])

  // Auto-scroll to bottom when appropriate
  useEffect(() => {
    if (scrollAreaRef.current && shouldAutoScroll) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [messages, shouldAutoScroll])

  const loadChatHistory = async () => {
    try {
      const response = await fetch(`/api/chat?projectId=${projectId}`, {
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.messages) {
          setMessages(data.messages)
        } else {
          // Add welcome message
          const welcomeMessage: Message = {
            id: "welcome",
            role: "agent",
            content: `Hello! I'm your AI agent for ${projectName}. I have full access to your project files and can help you with tasks, implementation, and deployment. What would you like to work on?`,
            timestamp: new Date().toISOString(),
            type: "text",
          }
          setMessages([welcomeMessage])
        }
      }
    } catch (error) {
      console.error("Error loading chat history:", error)
    }
  }

  const handleAutonomousFollowUp = async (agentResponse: string, currentMessages: Message[]) => {
    // Check if the response contains tool calls or indicates the agent will do something
    const needsFollowUp =
      agentResponse.includes("```tool_code") ||
      agentResponse.includes("I'll start by") ||
      agentResponse.includes("First, let's") ||
      agentResponse.includes("Let me check") ||
      agentResponse.includes("I'll examine") ||
      agentResponse.includes("I'll search") ||
      agentResponse.includes("I'll validate") ||
      agentResponse.includes("I'll inspect") ||
      agentResponse.includes("I'll fix") ||
      agentResponse.includes("I'll deploy") ||
      agentResponse.includes("I'll commit")

    if (needsFollowUp) {
      // Wait a moment then trigger autonomous follow-up
      setTimeout(async () => {
        setAgentStatus("working")

        try {
          const followUpResponse = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              projectId,
              action: "autonomous_followup",
              message: "Continue with the planned action",
              conversationHistory: currentMessages.slice(-10),
            }),
          })

          const followUpData = await followUpResponse.json()

          if (followUpData.success && followUpData.response) {
            const followUpMessage: Message = {
              id: `msg_${Date.now()}_followup`,
              role: "agent",
              content: followUpData.response,
              timestamp: new Date().toISOString(),
              type: "text",
            }

            setMessages((prev) => [...prev, followUpMessage])

            // Check if we need another follow-up
            if (followUpData.needsMoreFollowUp) {
              await handleAutonomousFollowUp(followUpData.response, [...currentMessages, followUpMessage])
            }
          }
        } catch (error) {
          console.error("Autonomous follow-up error:", error)
        } finally {
          setAgentStatus("idle")
        }
      }, 2000) // 2 second delay
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
      replyTo: replyingTo,
    }

    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInputValue("")
    setReplyingTo(null)
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
          replyTo: replyingTo,
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

        // Handle special actions
        await handleSpecialActions(inputValue, finalMessages)

        // Trigger autonomous follow-up
        await handleAutonomousFollowUp(data.response, finalMessages)

        onUpdate?.(data.response, "chat_response")
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error("Error sending message:", error)
      const errorMessage: Message = {
        id: `msg_${Date.now()}_error`,
        role: "agent",
        content: `I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}. Please try again.`,
        timestamp: new Date().toISOString(),
        type: "error",
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      setAgentStatus("idle")
    }
  }

  const handleSpecialActions = async (message: string, currentMessages: Message[]) => {
    const lowerMessage = message.toLowerCase()

    // Task creation
    if (lowerMessage.includes("create task") || lowerMessage.includes("add task")) {
      setAgentStatus("working")

      // Extract task details from message
      const taskTitle = message.match(/create task[:\s]+(.+)/i)?.[1] || "New Task"

      try {
        const response = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            projectId,
            action: "create",
            taskData: {
              title: taskTitle,
              description: `Task created from chat: ${message}`,
              priority: "medium",
            },
          }),
        })

        if (response.ok) {
          const taskMessage: Message = {
            id: `msg_${Date.now()}_task_created`,
            role: "agent",
            content: `✅ Task created successfully: "${taskTitle}"`,
            timestamp: new Date().toISOString(),
            type: "task",
          }
          setMessages((prev) => [...prev, taskMessage])
          onUpdate?.("task_created", "task_created")
        }
      } catch (error) {
        console.error("Error creating task:", error)
      }
    }

    // Task implementation
    if (lowerMessage.includes("implement") && (lowerMessage.includes("task") || lowerMessage.includes("all"))) {
      setAgentStatus("working")

      const implementMessage: Message = {
        id: `msg_${Date.now()}_implementing`,
        role: "agent",
        content: "🔨 Starting implementation... I'll work on the tasks and update the code files.",
        timestamp: new Date().toISOString(),
        type: "file_operation",
      }
      setMessages((prev) => [...prev, implementMessage])

      try {
        const action = lowerMessage.includes("all") ? "implement_all" : "implement"
        const response = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            projectId,
            action,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          const completionMessage: Message = {
            id: `msg_${Date.now()}_implementation_complete`,
            role: "agent",
            content: `✅ Implementation completed! ${data.results ? `Processed ${data.results.length} tasks.` : "Task completed successfully."}`,
            timestamp: new Date().toISOString(),
            type: "file_operation",
          }
          setMessages((prev) => [...prev, completionMessage])
          onUpdate?.("implementation_completed", "implementation_completed")
        }
      } catch (error) {
        console.error("Error implementing tasks:", error)
      }
    }
  }

  const handleReply = (messageId: string) => {
    setReplyingTo(messageId)
    const replyMessage = messages.find((m) => m.id === messageId)
    if (replyMessage) {
      setInputValue(`@${replyMessage.role}: `)
    }
  }

  const getReplyMessage = (replyToId: string) => {
    return messages.find((m) => m.id === replyToId)
  }

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button onClick={() => setIsOpen(true)} className="rounded-full w-14 h-14 shadow-lg" size="lg">
          <MessageCircle className="h-6 w-6" />
        </Button>
      </div>
    )
  }

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${isMinimized ? "w-80" : "w-96"}`}>
      <Card className={`shadow-2xl ${isMinimized ? "h-16" : "h-[500px]"} flex flex-col`}>
        <CardHeader className="pb-2 px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Bot className="h-4 w-4" />
              {projectName} - AI Agent
            </CardTitle>
            <div className="flex items-center gap-1">
              <Badge variant={agentStatus === "idle" ? "secondary" : "default"} className="text-xs">
                {agentStatus === "thinking" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                {agentStatus === "working" && <Zap className="h-3 w-3 mr-1" />}
                {agentStatus === "idle" && <CheckCircle className="h-3 w-3 mr-1" />}
                {agentStatus}
              </Badge>
              <Button variant="ghost" size="sm" onClick={() => setIsMinimized(!isMinimized)} className="h-6 w-6 p-0">
                {isMinimized ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)} className="h-6 w-6 p-0">
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {!isMinimized && (
          <>
            <ScrollArea className="flex-1 p-3" ref={scrollAreaRef}>
              <div className="space-y-3">
                {messages.map((message) => (
                  <div key={message.id} className="group">
                    {message.replyTo && (
                      <div className="text-xs text-slate-500 mb-1 pl-2 border-l-2 border-slate-200">
                        Replying to: {getReplyMessage(message.replyTo)?.content.slice(0, 50)}...
                      </div>
                    )}
                    <div className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          message.role === "user"
                            ? "bg-blue-500 text-white"
                            : message.type === "error"
                              ? "bg-red-50 border border-red-200"
                              : message.type === "task"
                                ? "bg-green-50 border border-green-200"
                                : message.type === "file_operation"
                                  ? "bg-purple-50 border border-purple-200"
                                  : "bg-slate-50 border border-slate-200"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {message.role === "user" ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                          <span className="text-xs font-medium">{message.role === "user" ? "You" : "AI Agent"}</span>
                          <span className="text-xs opacity-70">{new Date(message.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReply(message.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 mt-1"
                        >
                          <Reply className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 max-w-[80%]">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span className="text-sm">AI Agent is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <CardContent className="border-t p-3">
              {replyingTo && (
                <div className="text-xs text-slate-500 mb-2 p-2 bg-slate-50 rounded">
                  Replying to: {getReplyMessage(replyingTo)?.content.slice(0, 50)}...
                  <Button variant="ghost" size="sm" onClick={() => setReplyingTo(null)} className="h-4 w-4 p-0 ml-2">
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Ask me anything, create tasks, implement features, deploy..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  disabled={isLoading}
                  className="flex-1 text-sm"
                />
                <Button onClick={handleSendMessage} disabled={!inputValue.trim() || isLoading} size="sm">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  )
}
