import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { GitHubService } from "@/lib/github"

function getUserFromSession(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("user-session")?.value
    if (!sessionCookie) return null
    return JSON.parse(sessionCookie)
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromSession(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const credentials = await db.getCredentials(user.id)
    if (!credentials?.github_token) {
      return NextResponse.json({ success: true, repositories: [] })
    }

    const github = new GitHubService(credentials.github_token)

    try {
      // Get user's repositories
      const response = await fetch("https://api.github.com/user/repos?sort=updated&per_page=100", {
        headers: {
          Authorization: `token ${credentials.github_token}`,
          Accept: "application/vnd.github.v3+json",
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch repositories")
      }

      const repos = await response.json()

      const repositories = repos.map((repo: any) => ({
        id: repo.id.toString(),
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        language: repo.language,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        lastCommit: new Date(repo.updated_at).toLocaleDateString(),
        isPrivate: repo.private,
        url: repo.html_url,
        defaultBranch: repo.default_branch,
        size: repo.size,
      }))

      return NextResponse.json({ success: true, repositories })
    } catch (error) {
      console.error("Error fetching repositories:", error)
      return NextResponse.json({ success: true, repositories: [] })
    }
  } catch (error) {
    console.error("Repositories API error:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch repositories" })
  }
}
