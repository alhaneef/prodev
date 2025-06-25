import { type NextRequest, NextResponse } from "next/server"
import { getUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { GitHubStorageService } from "@/lib/github-storage"
import { GitHubService } from "@/lib/github"
import { AIAgent } from "@/lib/ai-agent"

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const projects = await db.project.findMany({
      where: { owner: user.username },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      success: true,
      projects,
    })
  } catch (error) {
    console.error("Error fetching projects:", error)
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, framework, template, repository, isCloned, context, generateAITasks, aiTaskContext } =
      body

    if (!name || !framework) {
      return NextResponse.json({ error: "Name and framework are required" }, { status: 400 })
    }

    // Create project in database
    const project = await db.project.create({
      data: {
        name,
        description: description || "",
        framework,
        template: template || "custom",
        repository: repository || `${user.username}/prodev-${Date.now()}`,
        owner: user.username,
        status: "active",
        progress: 0,
        context: context || "",
      },
    })

    try {
      // Initialize GitHub repository and storage
      const repoName = `prodev-${project.id}`
      const githubService = new GitHubService(process.env.GITHUB_TOKEN!)
      const githubStorage = new GitHubStorageService(process.env.GITHUB_TOKEN!, user.username, repoName)

      // Create GitHub repository if not cloned
      if (!isCloned) {
        try {
          await githubService.createRepository(user.username, repoName, {
            description: description || `${name} - Built with ProDev AI`,
            private: false,
          })
        } catch (repoError) {
          console.error("Error creating GitHub repository:", repoError)
          // Continue without failing - repository might already exist
        }
      }

      // Save project metadata
      await githubStorage.saveProjectMetadata({
        id: project.id,
        name,
        description: description || "",
        framework,
        template: template || "custom",
        owner: user.username,
        repository: repoName,
        context: context || "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      // Generate starter files based on template
      if (!isCloned) {
        await generateStarterFiles(githubStorage, framework, template, name)
      }

      // Generate AI tasks if requested
      if (generateAITasks && aiTaskContext && process.env.GOOGLE_AI_API_KEY) {
        try {
          const aiAgent = new AIAgent(process.env.GOOGLE_AI_API_KEY, githubStorage, githubService)
          const generatedTasks = await aiAgent.generateTasks(description || name, framework, aiTaskContext)
          await githubStorage.saveTasks(generatedTasks)
        } catch (aiError) {
          console.error("Error generating AI tasks:", aiError)
          // Continue without failing - tasks can be generated later
        }
      }

      // Update project with repository info
      const updatedProject = await db.project.update({
        where: { id: project.id },
        data: {
          repository: `${user.username}/${repoName}`,
        },
      })

      return NextResponse.json({
        success: true,
        project: updatedProject,
      })
    } catch (setupError) {
      console.error("Error setting up project:", setupError)

      // Clean up database entry if setup failed
      await db.project.delete({
        where: { id: project.id },
      })

      return NextResponse.json({ error: "Failed to set up project" }, { status: 500 })
    }
  } catch (error) {
    console.error("Error creating project:", error)
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 })
  }
}

async function generateStarterFiles(
  githubStorage: GitHubStorageService,
  framework: string,
  template: string,
  projectName: string,
) {
  const starterFiles: Record<string, string> = {}

  // Common files
  starterFiles["README.md"] = `# ${projectName}

Built with ProDev AI - An intelligent development platform.

## Getting Started

This project was created with the ${framework} framework using the ${template} template.

## Development

\`\`\`bash
npm install
npm run dev
\`\`\`

## Features

- Modern ${framework} setup
- AI-powered development assistance
- Automated task generation and implementation
- GitHub integration
- Real-time collaboration

## Learn More

Visit [ProDev AI](https://prodev.ai) to learn more about intelligent development.
`

  starterFiles[".gitignore"] = `# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
/coverage

# Next.js
/.next/
/out/

# Production
/build

# Misc
.DS_Store
*.pem

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Local env files
.env*.local
.env

# Vercel
.vercel

# TypeScript
*.tsbuildinfo
next-env.d.ts
`

  // Framework-specific files
  if (framework === "Next.js") {
    starterFiles["package.json"] = JSON.stringify(
      {
        name: projectName.toLowerCase().replace(/\s+/g, "-"),
        version: "0.1.0",
        private: true,
        scripts: {
          dev: "next dev",
          build: "next build",
          start: "next start",
          lint: "next lint",
        },
        dependencies: {
          next: "14.0.0",
          react: "^18",
          "react-dom": "^18",
          typescript: "^5",
          "@types/node": "^20",
          "@types/react": "^18",
          "@types/react-dom": "^18",
          tailwindcss: "^3.3.0",
          autoprefixer: "^10.4.16",
          postcss: "^8.4.31",
        },
      },
      null,
      2,
    )

    starterFiles["next.config.js"] = `/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
}

module.exports = nextConfig
`

    starterFiles["tailwind.config.js"] = `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
`

    starterFiles["postcss.config.js"] = `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`

    starterFiles["app/layout.tsx"] = `import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '${projectName}',
  description: 'Built with ProDev AI',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
`

    starterFiles["app/page.tsx"] = `export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <h1 className="text-4xl font-bold text-center">
          Welcome to ${projectName}
        </h1>
      </div>

      <div className="relative flex place-items-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-4">
            Built with ProDev AI
          </h2>
          <p className="text-lg text-gray-600">
            Your intelligent development platform
          </p>
        </div>
      </div>

      <div className="mb-32 grid text-center lg:max-w-5xl lg:w-full lg:mb-0 lg:grid-cols-4 lg:text-left">
        <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100">
          <h2 className="mb-3 text-2xl font-semibold">
            AI Tasks{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              →
            </span>
          </h2>
          <p className="m-0 max-w-[30ch] text-sm opacity-50">
            Generate and implement tasks with AI assistance
          </p>
        </div>

        <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100">
          <h2 className="mb-3 text-2xl font-semibold">
            Smart Code{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              →
            </span>
          </h2>
          <p className="m-0 max-w-[30ch] text-sm opacity-50">
            Intelligent code generation and optimization
          </p>
        </div>

        <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100">
          <h2 className="mb-3 text-2xl font-semibold">
            GitHub Sync{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              →
            </span>
          </h2>
          <p className="m-0 max-w-[30ch] text-sm opacity-50">
            Seamless integration with GitHub repositories
          </p>
        </div>

        <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100">
          <h2 className="mb-3 text-2xl font-semibold">
            Live Preview{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              →
            </span>
          </h2>
          <p className="m-0 max-w-[30ch] text-sm opacity-50">
            Real-time development environment
          </p>
        </div>
      </div>
    </main>
  )
}
`

    starterFiles["app/globals.css"] = `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground-rgb: 0, 0, 0;
  --background-start-rgb: 214, 219, 220;
  --background-end-rgb: 255, 255, 255;
}

@media (prefers-color-scheme: dark) {
  :root {
    --foreground-rgb: 255, 255, 255;
    --background-start-rgb: 0, 0, 0;
    --background-end-rgb: 0, 0, 0;
  }
}

body {
  color: rgb(var(--foreground-rgb));
  background: linear-gradient(
      to bottom,
      transparent,
      rgb(var(--background-end-rgb))
    )
    rgb(var(--background-start-rgb));
}
`

    starterFiles["tsconfig.json"] = JSON.stringify(
      {
        compilerOptions: {
          target: "es5",
          lib: ["dom", "dom.iterable", "es6"],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: "esnext",
          moduleResolution: "bundler",
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: "preserve",
          incremental: true,
          plugins: [
            {
              name: "next",
            },
          ],
          paths: {
            "@/*": ["./*"],
          },
        },
        include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
        exclude: ["node_modules"],
      },
      null,
      2,
    )
  }

  // Save all files
  for (const [filePath, content] of Object.entries(starterFiles)) {
    try {
      await githubStorage.updateFileContent(filePath, content, `Initialize ${filePath}`)
    } catch (error) {
      console.error(`Error creating file ${filePath}:`, error)
    }
  }
}
