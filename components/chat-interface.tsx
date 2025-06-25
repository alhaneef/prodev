"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Send, Bot, User, Copy, Check, Terminal, Code, FileText, Zap, RefreshCw } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
  type?: "text" | "code" | "command" | "error"
  metadata?: any
}

interface ChatInterfaceProps {
  projectId: string
  onTaskUpdate?: (taskId: string, action: string) => void
}

export function ChatInterface({ projectId, onTaskUpdate }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `# 🚀 Welcome to ProDev AI Assistant

I'm your intelligent development companion with full access to your codebase and development environment.

## 🎯 What I can do:

### 📁 **File Operations**
- List all files: \`ls\` or \`list files\`
- View file content: \`cat filename\` or \`show me filename\`
- Create/edit files with full code implementation
- Search across your codebase

### 🔧 **Task Management**
- Generate intelligent tasks based on your project
- Implement tasks automatically with code commits
- Track progress and manage dependencies

### 💻 **Terminal Access**
- Execute any terminal command
- Run npm/git commands
- Debug and troubleshoot issues

### 🤖 **AI Development**
- Write complete features and components
- Fix bugs and optimize code
- Suggest improvements and best practices

**Try asking me:** "List all files" or "Create a new React component" or "Generate tasks for my project"`,
      timestamp: new Date().toISOString(),
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId,
          message: input.trim(),
          conversationHistory: messages.slice(-10), // Last 10 messages for context
        }),
      })

      if (response.ok) {
        const data = await response.json()

        const assistantMessage: Message = {
          id: `assistant_${Date.now()}`,
          role: "assistant",
          content: data.response || "I apologize, but I couldn't process your request.",
          timestamp: new Date().toISOString(),
          metadata: data.metadata,
        }

        setMessages((prev) => [...prev, assistantMessage])

        // Handle any task updates
        if (data.taskUpdate && onTaskUpdate) {
          onTaskUpdate(data.taskUpdate.taskId, data.taskUpdate.action)
        }
      } else {
        const errorMessage: Message = {
          id: `error_${Date.now()}`,
          role: "assistant",
          content: "❌ I encountered an error processing your request. Please try again.",
          timestamp: new Date().toISOString(),
          type: "error",
        }
        setMessages((prev) => [...prev, errorMessage])
      }
    } catch (error) {
      console.error("Error sending message:", error)
      const errorMessage: Message = {
        id: `error_${Date.now()}`,
        role: "assistant",
        content: "❌ Network error. Please check your connection and try again.",
        timestamp: new Date().toISOString(),
        type: "error",
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedMessageId(messageId)
      setTimeout(() => setCopiedMessageId(null), 2000)
    } catch (error) {
      console.error("Failed to copy:", error)
    }
  }

  const renderMessage = (message: Message) => {
    const isUser = message.role === "user"
    const isError = message.type === "error"

    return (
      <div
        key={message.id}
        className={`flex gap-3 p-4 ${isUser ? "bg-blue-50" : isError ? "bg-red-50" : "bg-slate-50"} rounded-lg`}
      >
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            isUser ? "bg-blue-600 text-white" : isError ? "bg-red-600 text-white" : "bg-slate-600 text-white"
          }`}
        >
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium text-sm">{isUser ? "You" : "AI Assistant"}</span>
            <span className="text-xs text-slate-500">{new Date(message.timestamp).toLocaleTimeString()}</span>
            {message.metadata?.executedCommands && (
              <Badge variant="outline" className="text-xs">
                <Terminal className="h-3 w-3 mr-1" />
                Commands: {message.metadata.executedCommands}
              </Badge>
            )}
            {message.metadata?.filesModified && (
              <Badge variant="outline" className="text-xs">
                <FileText className="h-3 w-3 mr-1" />
                Files: {message.metadata.filesModified}
              </Badge>
            )}
          </div>

          <div className="prose prose-sm max-w-none">
            {isUser ? (
              <p className="text-slate-900 whitespace-pre-wrap">{message.content}</p>
            ) : (
              <ReactMarkdown
                components={{
                  code({ node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "")
                    const language = match ? match[1] : ""

                    if (!inline && language) {
                      return (
                        <div className="relative">
                          <div className="flex items-center justify-between bg-slate-800 text-white px-4 py-2 rounded-t-md">
                            <span className="text-sm font-medium">{language}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-white hover:bg-slate-700"
                              onClick={() => copyToClipboard(String(children), message.id)}
                            >
                              {copiedMessageId === message.id ? (
                                <Check className="h-3 w-3" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                          <SyntaxHighlighter
                            style={oneDark}
                            language={language}
                            PreTag="div"
                            className="rounded-t-none"
                            {...props}
                          >
                            {String(children).replace(/\n$/, "")}
                          </SyntaxHighlighter>
                        </div>
                      )
                    }

                    return (
                      <code className="bg-slate-100 px-1 py-0.5 rounded text-sm font-mono" {...props}>
                        {children}
                      </code>
                    )
                  },
                  pre({ children }) {
                    return <div className="my-4">{children}</div>
                  },
                  blockquote({ children }) {
                    return (
                      <blockquote className="border-l-4 border-blue-500 pl-4 italic text-slate-600 my-4">
                        {children}
                      </blockquote>
                    )
                  },
                  h1({ children }) {
                    return <h1 className="text-2xl font-bold mb-4 text-slate-900">{children}</h1>
                  },
                  h2({ children }) {
                    return <h2 className="text-xl font-semibold mb-3 text-slate-900">{children}</h2>
                  },
                  h3({ children }) {
                    return <h3 className="text-lg font-medium mb-2 text-slate-900">{children}</h3>
                  },
                  ul({ children }) {
                    return <ul className="list-disc list-inside space-y-1 mb-4">{children}</ul>
                  },
                  ol({ children }) {
                    return <ol className="list-decimal list-inside space-y-1 mb-4">{children}</ol>
                  },
                  li({ children }) {
                    return <li className="text-slate-700">{children}</li>
                  },
                  p({ children }) {
                    return <p className="mb-3 text-slate-700 leading-relaxed">{children}</p>
                  },
                  a({ href, children }) {
                    return (
                      <a
                        href={href}
                        className="text-blue-600 hover:text-blue-800 underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {children}
                      </a>
                    )
                  },
                  table({ children }) {
                    return (
                      <div className="overflow-x-auto my-4">
                        <table className="min-w-full border border-slate-300">{children}</table>
                      </div>
                    )
                  },
                  th({ children }) {
                    return (
                      <th className="border border-slate-300 px-4 py-2 bg-slate-100 font-medium text-left">
                        {children}
                      </th>
                    )
                  },
                  td({ children }) {
                    return <td className="border border-slate-300 px-4 py-2">{children}</td>
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            )}
          </div>

          {!isUser && (
            <div className="flex items-center gap-2 mt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(message.content, message.id)}
                className="text-xs"
              >
                {copiedMessageId === message.id ? (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </>
                )}
              </Button>

              {message.metadata?.hasActions && (
                <Badge variant="outline" className="text-xs">
                  <Zap className="h-3 w-3 mr-1" />
                  Actions Available
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  const quickActions = [
    {
      label: "List Files",
      command: "list all files",
      icon: <FileText className="h-3 w-3" />,
    },
    {
      label: "Generate Tasks",
      command: "generate tasks for my project",
      icon: <Zap className="h-3 w-3" />,
    },
    {
      label: "Terminal",
      command: "ls -la",
      icon: <Terminal className="h-3 w-3" />,
    },
    {
      label: "Code Review",
      command: "review my code and suggest improvements",
      icon: <Code className="h-3 w-3" />,
    },
  ]

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Assistant
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{messages.length - 1} messages</Badge>
            <Button variant="ghost" size="sm" onClick={() => setMessages([messages[0]])}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        {/* Messages */}
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-4 pb-4">
            {messages.map(renderMessage)}
            {isLoading && (
              <div className="flex gap-3 p-4 bg-slate-50 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-600 text-white flex items-center justify-center">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-sm">AI Assistant</span>
                    <RefreshCw className="h-3 w-3 animate-spin text-slate-500" />
                  </div>
                  <div className="text-slate-600">Thinking...</div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Quick Actions */}
        <div className="border-t p-4">
          <div className="flex flex-wrap gap-2 mb-3">
            {quickActions.map((action, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => setInput(action.command)}
                className="text-xs"
              >
                {action.icon}
                <span className="ml-1">{action.label}</span>
              </Button>
            ))}
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder="Ask me anything about your project..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button onClick={sendMessage} disabled={!input.trim() || isLoading} size="sm">
              {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
