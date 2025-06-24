import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { GitHubService } from "@/lib/github"
import { DeploymentService } from "@/lib/deployment"
import { GitHubStorageService } from "@/lib/github-storage"

function getUserFromSession(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("user-session")?.value
    if (!sessionCookie) return null
    return JSON.parse(sessionCookie)
  } catch {
    return null
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

      // Check for vercel.json and validate it
      const vercelJsonFile = validFiles.find((f) => f.path === "vercel.json")
      if (vercelJsonFile) {
        try {
          JSON.parse(vercelJsonFile.content)
        } catch (jsonError) {
          // Invalid JSON in vercel.json - fix it
          const fixedVercelJson = {
            version: 2,
            builds: [
              {
                src: "package.json",
                use: "@vercel/static-build",
              },
            ],
          }

          vercelJsonFile.content = JSON.stringify(fixedVercelJson, null, 2)

          // Update the file in GitHub
          await githubStorage.updateFileContent(
            "vercel.json",
            vercelJsonFile.content,
            "🔧 Fix invalid JSON in vercel.json",
          )

          // Log the fix
          const fixLog = {
            projectId,
            platform,
            status: "fixing",
            message: "Fixed invalid JSON in vercel.json",
            timestamp: new Date().toISOString(),
          }

          await githubStorage.updateFileContent(
            ".prodev/deployment-logs.json",
            JSON.stringify([deploymentLog, fixLog], null, 2),
            "🔧 Log deployment fix",
          )
        }
      }

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

        // Verify deployment actually worked by checking the URL
        const verificationResponse = await fetch(deploymentResult.url, { method: "HEAD" })
        const actualStatus = verificationResponse.ok ? "success" : "failed"

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
          status: actualStatus,
          message:
            actualStatus === "success"
              ? "Deployment completed successfully"
              : "Deployment completed but site not accessible",
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
          success: actualStatus === "success",
          deploymentUrl: deploymentResult.url,
          deploymentId: deploymentResult.id,
          previewUrl: deploymentResult.url,
          status: actualStatus,
          message:
            actualStatus === "success" ? "Deployment successful" : "Deployment completed but verification failed",
        })
      } catch (deployError) {
        // Log deployment error
        const errorLog = {
          projectId,
          platform,
          status: "failed",
          message: `Deployment failed: ${deployError instanceof Error ? deployError.message : "Unknown error"}`,
          error: deployError instanceof Error ? deployError.message : "Unknown error",
          timestamp: new Date().toISOString(),
        }

        await githubStorage.updateFileContent(
          ".prodev/deployment-logs.json",
          JSON.stringify([deploymentLog, errorLog], null, 2),
          "❌ Log deployment error",
        )

        throw deployError
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
