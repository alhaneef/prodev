import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { GitHubService } from "@/lib/github"
import { DeploymentService } from "@/lib/deployment"
import { GitHubStorageService } from "@/lib/github-storage"
import { AIAgent } from "@/lib/ai-agent"

function getUserFromSession(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("user-session")?.value
    if (!sessionCookie) return null
    return JSON.parse(sessionCookie)
  } catch {
    return null
  }
}

// Dynamic deployment error auto-fix function
async function attemptAutonomousFix(deploymentLogs: string, project: any, githubStorage: any, credentials: any) {
  console.log("🤖 AI Agent analyzing deployment error...")

  if (!credentials.gemini_api_key) {
    console.log("❌ No Gemini API key available for auto-fix")
    return { fixed: false, description: "No AI API key available" }
  }

  try {
    const github = new GitHubService(credentials.github_token)
    const aiAgent = new AIAgent(credentials.gemini_api_key, githubStorage, github)

    // Get current project files for context
    const [owner, repo] = project.repository.split("/").slice(-2)
    const files = await github.listFiles(owner, repo)

    const projectFiles = await Promise.all(
      files.slice(0, 10).map(async (file) => {
        try {
          if (file.type === "file") {
            const content = await github.getFileContent(owner, repo, file.path)
            return `${file.path}:\n${content.content.slice(0, 500)}...\n`
          }
        } catch (error) {
          return `${file.path}: Error reading file\n`
        }
        return ""
      }),
    )

    const fixPrompt = `
    You are an expert deployment engineer. Analyze this deployment error and provide a fix.
    
    Project: ${project.name}
    Framework: ${project.framework}
    Platform: Vercel
    
    Deployment Logs:
    ${deploymentLogs}
    
    Current Project Files:
    ${projectFiles.join("\n")}
    
    CRITICAL INSTRUCTIONS:
    1. Analyze the deployment logs to identify the root cause
    2. Provide specific file fixes based on the actual error
    3. Return ONLY valid JSON in this exact format
    4. Do NOT include markdown or explanations
    
    Common deployment issues and fixes:
    - JSON parsing errors: Fix malformed JSON files
    - Missing dependencies: Add to package.json
    - Build script errors: Fix build commands
    - Environment variable issues: Add default values
    - File path errors: Correct import paths
    - TypeScript errors: Fix type issues
    - Missing files: Create required files
    
    Return this exact JSON structure:
    {
      "canFix": true,
      "description": "Brief description of the fix",
      "files": [
        {
          "path": "relative/path/to/file.ext",
          "content": "complete fixed file content",
          "operation": "create|update"
        }
      ],
      "commitMessage": "fix: description of deployment fix"
    }
    
    If you cannot determine a fix, return:
    {
      "canFix": false,
      "description": "Unable to determine fix for this error",
      "files": [],
      "commitMessage": ""
    }
    `

    const result = await aiAgent.model.generateContent(fixPrompt)
    const response = await result.response
    let text = response.text().trim()

    // Clean up the response
    if (text.startsWith("```json")) {
      text = text.replace(/```json\n?/, "").replace(/\n?```$/, "")
    }
    if (text.startsWith("```")) {
      text = text.replace(/```\n?/, "").replace(/\n?```$/, "")
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error("No valid JSON found in AI response")
    }

    const fixResult = JSON.parse(jsonMatch[0])

    if (fixResult.canFix && fixResult.files && fixResult.files.length > 0) {
      console.log(`✅ AI Agent generated fix: ${fixResult.description}`)

      // Apply the fixes to GitHub
      for (const file of fixResult.files) {
        try {
          await githubStorage.updateFileContent(file.path, file.content, fixResult.commitMessage)
          console.log(`✅ Fixed file: ${file.path}`)
        } catch (fileError) {
          console.error(`❌ Error fixing file ${file.path}:`, fileError)
        }
      }

      return {
        fixed: true,
        description: fixResult.description,
        filesFixed: fixResult.files.length,
        commitMessage: fixResult.commitMessage,
      }
    } else {
      console.log(`❌ AI Agent could not generate fix: ${fixResult.description}`)
      return {
        fixed: false,
        description: fixResult.description || "No fix could be determined",
      }
    }
  } catch (error) {
    console.error("❌ AI Agent auto-fix failed:", error)
    return {
      fixed: false,
      description: `Auto-fix failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromSession(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { projectId, platform = "vercel" } = await request.json()

    // Get project and verify ownership
    const project = await db.getProject(projectId)
    if (!project || project.user_id !== user.id) {
      return NextResponse.json({ success: false, error: "Project not found" })
    }

    const credentials = await db.getCredentials(user.id)
    if (!credentials) {
      return NextResponse.json({ success: false, error: "Credentials not found" })
    }

    // Check if platform credentials exist
    const platformToken = credentials[`${platform}_token` as keyof typeof credentials]
    if (!platformToken) {
      return NextResponse.json({
        success: false,
        error: `${platform} credentials not configured. Please add them in Settings.`,
      })
    }

    // Get project files from GitHub
    if (!credentials.github_token) {
      return NextResponse.json({ success: false, error: "GitHub credentials required" })
    }

    const github = new GitHubService(credentials.github_token)
    const [owner, repo] = project.repository.split("/").slice(-2)
    const githubStorage = new GitHubStorageService(github, owner, repo)

    try {
      // Log deployment start
      const deploymentLog = {
        projectId,
        platform,
        status: "starting",
        message: "Starting deployment process...",
        timestamp: new Date().toISOString(),
      }

      await githubStorage.updateFileContent(
        ".prodev/deployment-logs.json",
        JSON.stringify([deploymentLog], null, 2),
        "🚀 Start deployment",
      )

      const files = await github.listFiles(owner, repo)

      // Convert GitHub files to deployment format
      const deploymentFiles = await Promise.all(
        files
          .filter((file) => file.type === "file")
          .map(async (file) => {
            try {
              const content = await github.getFileContent(owner, repo, file.path)
              return {
                path: file.path,
                content: content.content,
              }
            } catch (error) {
              console.error(`Failed to get content for ${file.path}:`, error)
              return null
            }
          }),
      )

      const validFiles = deploymentFiles.filter(Boolean) as Array<{ path: string; content: string }>

      // Deploy based on platform
      const deploymentService = new DeploymentService()
      const deployConfig = {
        platform: platform as "vercel" | "netlify" | "cloudflare",
        token: platformToken as string,
        projectName: project.name.toLowerCase().replace(/\s+/g, "-"),
        framework: project.framework,
        buildCommand: getFrameworkBuildCommand(project.framework),
        outputDirectory: getFrameworkOutputDir(project.framework),
      }

      let deploymentResult
      let deploymentLogs = ""

      try {
        switch (platform) {
          case "vercel":
            deploymentResult = await deploymentService.deployToVercel(deployConfig, validFiles)
            break
          case "netlify":
            deploymentResult = await deploymentService.deployToNetlify(deployConfig, validFiles)
            break
          case "cloudflare":
            deploymentResult = await deploymentService.deployToCloudflare(deployConfig, validFiles)
            break
          default:
            throw new Error("Unsupported deployment platform")
        }

        // Update project with deployment info
        await db.updateProject(projectId, {
          deployment_url: deploymentResult.url,
          deployment_platform: platform,
          last_deployment: new Date().toISOString(),
        })

        // Log successful deployment
        const successLog = {
          projectId,
          platform,
          status: "success",
          message: "Deployment completed successfully",
          deploymentUrl: deploymentResult.url,
          deploymentId: deploymentResult.id,
          timestamp: new Date().toISOString(),
        }

        await githubStorage.updateFileContent(
          ".prodev/deployment-logs.json",
          JSON.stringify([deploymentLog, successLog], null, 2),
          "✅ Log deployment success",
        )

        return NextResponse.json({
          success: true,
          deploymentUrl: deploymentResult.url,
          deploymentId: deploymentResult.id,
          previewUrl: deploymentResult.url,
          status: "success",
          message: "Deployment successful",
        })
      } catch (deployError) {
        // Capture deployment logs/error details
        deploymentLogs = deployError instanceof Error ? deployError.message : String(deployError)
        console.error("Deployment error:", deployError)

        // Log deployment error
        const errorLog = {
          projectId,
          platform,
          status: "failed",
          message: `Deployment failed: ${deploymentLogs}`,
          error: deploymentLogs,
          timestamp: new Date().toISOString(),
        }

        await githubStorage.updateFileContent(
          ".prodev/deployment-logs.json",
          JSON.stringify([deploymentLog, errorLog], null, 2),
          "❌ Log deployment error",
        )

        // Attempt autonomous fix with AI
        console.log("🤖 AI Agent attempting to fix deployment error...")

        try {
          const fixResult = await attemptAutonomousFix(deploymentLogs, project, githubStorage, credentials)

          if (fixResult.fixed) {
            console.log(`✅ Auto-fix applied: ${fixResult.description}`)

            // Log the fix
            const fixLog = {
              projectId,
              platform,
              status: "fixing",
              message: `Auto-fix applied: ${fixResult.description}`,
              filesFixed: fixResult.filesFixed || 0,
              timestamp: new Date().toISOString(),
            }

            await githubStorage.updateFileContent(
              ".prodev/deployment-logs.json",
              JSON.stringify([deploymentLog, errorLog, fixLog], null, 2),
              "🔧 Log auto-fix attempt",
            )

            // Wait for GitHub to process the changes
            await new Promise((resolve) => setTimeout(resolve, 5000))

            // Retry deployment with fresh files
            console.log("🔄 Retrying deployment after auto-fix...")

            const retryFiles = await github.listFiles(owner, repo)
            const retryDeploymentFiles = await Promise.all(
              retryFiles
                .filter((file) => file.type === "file")
                .map(async (file) => {
                  try {
                    const content = await github.getFileContent(owner, repo, file.path)
                    return {
                      path: file.path,
                      content: content.content,
                    }
                  } catch (error) {
                    console.error(`Failed to get content for ${file.path}:`, error)
                    return null
                  }
                }),
            )

            const validRetryFiles = retryDeploymentFiles.filter(Boolean) as Array<{ path: string; content: string }>

            try {
              let retryResult
              switch (platform) {
                case "vercel":
                  retryResult = await deploymentService.deployToVercel(deployConfig, validRetryFiles)
                  break
                case "netlify":
                  retryResult = await deploymentService.deployToNetlify(deployConfig, validRetryFiles)
                  break
                case "cloudflare":
                  retryResult = await deploymentService.deployToCloudflare(deployConfig, validRetryFiles)
                  break
                default:
                  throw new Error("Unsupported deployment platform")
              }

              // Update project with successful deployment
              await db.updateProject(projectId, {
                deployment_url: retryResult.url,
                deployment_platform: platform,
                last_deployment: new Date().toISOString(),
              })

              const successLog = {
                projectId,
                platform,
                status: "success",
                message: "Deployment successful after auto-fix",
                deploymentUrl: retryResult.url,
                deploymentId: retryResult.id,
                timestamp: new Date().toISOString(),
              }

              await githubStorage.updateFileContent(
                ".prodev/deployment-logs.json",
                JSON.stringify([deploymentLog, errorLog, fixLog, successLog], null, 2),
                "✅ Log successful retry",
              )

              return NextResponse.json({
                success: true,
                deploymentUrl: retryResult.url,
                deploymentId: retryResult.id,
                status: "success",
                message: "Deployment successful after auto-fix",
                autoFixed: true,
                fixDescription: fixResult.description,
              })
            } catch (retryError) {
              console.error("Retry deployment failed:", retryError)

              const retryFailLog = {
                projectId,
                platform,
                status: "retry_failed",
                message: `Retry failed after auto-fix: ${retryError instanceof Error ? retryError.message : "Unknown error"}`,
                timestamp: new Date().toISOString(),
              }

              await githubStorage.updateFileContent(
                ".prodev/deployment-logs.json",
                JSON.stringify([deploymentLog, errorLog, fixLog, retryFailLog], null, 2),
                "❌ Log retry failure",
              )
            }
          } else {
            console.log(`❌ AI Agent could not generate automatic fix: ${fixResult.description}`)
          }
        } catch (fixError) {
          console.error("Auto-fix failed:", fixError)
          console.log("❌ AI Agent could not generate automatic fix")
        }

        return NextResponse.json({
          success: false,
          error: deploymentLogs,
          logs: deploymentLogs,
        })
      }
    } catch (deployError) {
      console.error("Deployment error:", deployError)
      return NextResponse.json({
        success: false,
        error: deployError instanceof Error ? deployError.message : "Deployment failed",
      })
    }
  } catch (error) {
    console.error("Deploy API error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Deployment failed",
    })
  }
}

function getFrameworkBuildCommand(framework: string): string {
  const commands: Record<string, string> = {
    "Next.js": "npm run build",
    React: "npm run build",
    "Vue.js": "npm run build",
    Svelte: "npm run build",
    Angular: "npm run build",
  }
  return commands[framework] || "npm run build"
}

function getFrameworkOutputDir(framework: string): string {
  const dirs: Record<string, string> = {
    "Next.js": "out",
    React: "build",
    "Vue.js": "dist",
    Svelte: "public",
    Angular: "dist",
  }
  return dirs[framework] || "build"
}
