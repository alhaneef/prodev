import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { GitHubService } from "@/lib/github"
import { GitHubStorageService } from "@/lib/github-storage"
import { AIAgent } from "@/lib/ai-agent"
import { getUserFromSession } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromSession(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const projects = await db.getUserProjects(user.id)
    return NextResponse.json({ success: true, projects })
  } catch (error) {
    console.error("Error fetching projects:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch projects" })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromSession(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { name, description, framework, template } = await request.json()

    // Get user credentials
    const credentials = await db.getCredentials(user.id)
    if (!credentials?.github_token) {
      return NextResponse.json({
        success: false,
        error: "GitHub credentials required. Please configure them in Settings first.",
      })
    }

    // Create GitHub repository
    const github = new GitHubService(credentials.github_token)
    const repoName = name.toLowerCase().replace(/\s+/g, "-")

    let repo
    try {
      repo = await github.createRepository(repoName, description, true)
    } catch (error) {
      console.error("GitHub repository creation failed:", error)
      return NextResponse.json({
        success: false,
        error: "Failed to create GitHub repository. Please check your GitHub token permissions.",
      })
    }

    // Create project in database
    const project = {
      id: `proj_${Date.now()}`,
      user_id: user.id,
      name,
      description,
      framework,
      repository: repo.full_name,
      owner: repo.owner.login,
      status: "active" as const,
      progress: 0,
      autonomous_mode: true,
      auto_approve: false,
      code_quality: "production" as const,
    }

    const createdProject = await db.createProject(project)

    // Initialize GitHub storage service
    const githubStorage = new GitHubStorageService(credentials.github_token, repo.owner.login, repoName)

    // Initialize project structure in GitHub
    await githubStorage.initializeProjectStructure(project.id)

    // Generate initial project structure and tasks with AI
    if (credentials.gemini_api_key) {
      try {
        const aiAgent = new AIAgent(credentials.gemini_api_key, githubStorage)

        // Generate initial files
        const initialFiles = await aiAgent.generateInitialProjectStructure(framework, name, description)

        // Commit initial files to repository
        for (const file of initialFiles) {
          try {
            await github.createFile(
              repo.owner.login,
              repoName,
              file.path,
              file.content,
              `🚀 Initial ${framework} project setup - ${file.path}`,
            )
          } catch (fileError) {
            console.error(`Failed to create file ${file.path}:`, fileError)
          }
        }

        // Generate tasks
        const tasks = await aiAgent.generateTasks(description, framework)

        // Save tasks to database and GitHub
        for (const task of tasks) {
          try {
            await db.createTask({
              ...task,
              project_id: project.id,
            })
          } catch (taskError) {
            console.error("Failed to create task:", taskError)
          }
        }

        // Save to GitHub storage
        await githubStorage.saveTasks(tasks)

        // Initialize project metadata in GitHub
        const metadata = {
          id: project.id,
          name: project.name,
          description: project.description || "",
          framework: project.framework,
          status: project.status,
          progress: 0,
          created_at: createdProject.created_at,
          updated_at: createdProject.updated_at,
          tasks: tasks,
          sprints: [],
          settings: {
            autonomous_mode: project.autonomous_mode,
            auto_approve: project.auto_approve,
            code_quality: project.code_quality,
          },
        }

        await githubStorage.saveProjectMetadata(metadata)

        // Initialize agent memory
        const initialMemory = {
          projectId: project.id,
          conversationHistory: [],
          taskHistory: [],
          codeContext: initialFiles.map((f) => ({ path: f.path, type: "initial" })),
          learnings: {
            initialization: {
              framework: framework,
              template: template,
              filesCreated: initialFiles.length,
              tasksGenerated: tasks.length,
              timestamp: new Date().toISOString(),
            },
          },
          currentFocus: "Initial project setup completed",
          lastUpdate: new Date().toISOString(),
        }

        await githubStorage.saveAgentMemory(initialMemory)

        // Start autonomous task execution if enabled
        if (project.autonomous_mode && tasks.length > 0) {
          // Execute first task autonomously
          try {
            const result = await aiAgent.executeAutonomousTask(project)
            if (result.success) {
              // Commit the implementation
              for (const file of result.implementation.files) {
                try {
                  await github.createFile(
                    repo.owner.login,
                    repoName,
                    file.path,
                    file.content,
                    result.implementation.commitMessage || `✨ ${result.task.title}`,
                  )
                } catch (fileError) {
                  console.error(`Failed to commit file ${file.path}:`, fileError)
                }
              }

              // Update project progress
              await db.updateProject(project.id, { progress: result.progress })
            }
          } catch (autoError) {
            console.error("Autonomous execution error:", autoError)
          }
        }

        return NextResponse.json({
          success: true,
          project: createdProject,
          tasks,
          repository: repo.html_url,
          message: "Project created successfully with AI-generated structure and autonomous execution started",
        })
      } catch (aiError) {
        console.error("AI generation error:", aiError)
        // Continue without AI features
      }
    }

    return NextResponse.json({ success: true, project: createdProject })
  } catch (error) {
    console.error("Error creating project:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to create project",
    })
  }
}
