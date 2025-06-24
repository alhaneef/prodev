import JSZip from "jszip"

export interface DeploymentConfig {
  platform: "vercel" | "netlify" | "cloudflare"
  token: string
  projectName: string
  framework: string
  buildCommand?: string
  outputDirectory?: string
  environmentVariables?: Record<string, string>
}

function mapFrameworkToVercel(framework: string): string {
  const frameworkMap: Record<string, string> = {
    "Next.js": "nextjs",
    React: "create-react-app",
    "Vue.js": "vue",
    Svelte: "svelte",
    SvelteKit: "sveltekit",
    Angular: "angular",
    "Nuxt.js": "nuxtjs",
    Gatsby: "gatsby",
    Remix: "remix",
    Astro: "astro",
    Vite: "vite",
    Preact: "preact",
    Solid: "solidstart",
    Ember: "ember",
    Hugo: "hugo",
    Jekyll: "jekyll",
    Docusaurus: "docusaurus-2",
    Storybook: "storybook",
  }
  return frameworkMap[framework] || "nextjs" // Default to nextjs
}

function mapFrameworkToNetlify(framework: string): string {
  const frameworkMap: Record<string, string> = {
    "Next.js": "nextjs",
    React: "create-react-app",
    "Vue.js": "vue-cli",
    Svelte: "svelte",
    Angular: "angular",
    Gatsby: "gatsby",
    Hugo: "hugo",
    Jekyll: "jekyll",
  }
  return frameworkMap[framework] || "static"
}

export class DeploymentService {
  async deployToVercel(config: DeploymentConfig, files: Array<{ path: string; content: string }>) {
    try {
      const response = await fetch("https://api.vercel.com/v13/deployments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: config.projectName,
          files: files.map((file) => ({
            file: file.path,
            data: Buffer.from(file.content).toString("base64"),
          })),
          projectSettings: {
            framework: mapFrameworkToVercel(config.framework),
            buildCommand: config.buildCommand,
            outputDirectory: config.outputDirectory,
          },
          env: config.environmentVariables,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Vercel deployment failed: ${error}`)
      }

      const deployment = await response.json()
      return {
        url: `https://${deployment.url}`,
        id: deployment.id,
        status: "success",
      }
    } catch (error) {
      console.error("Vercel deployment error:", error)
      throw error
    }
  }

  async deployToNetlify(config: DeploymentConfig, files: Array<{ path: string; content: string }>) {
    try {
      // Create a zip file of the project
      const formData = new FormData()
      const zip = new JSZip()

      files.forEach((file) => {
        zip.file(file.path, file.content)
      })

      const zipBlob = await zip.generateAsync({ type: "blob" })
      formData.append("file", zipBlob)

      const response = await fetch("https://api.netlify.com/api/v1/sites", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Netlify deployment failed: ${error}`)
      }

      const site = await response.json()
      return {
        url: site.ssl_url || site.url,
        id: site.id,
        status: "success",
      }
    } catch (error) {
      console.error("Netlify deployment error:", error)
      throw error
    }
  }

  async deployToCloudflare(config: DeploymentConfig, files: Array<{ path: string; content: string }>) {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/pages/projects`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: config.projectName,
            production_branch: "main",
            build_config: {
              build_command: config.buildCommand,
              destination_dir: config.outputDirectory,
            },
          }),
        },
      )

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Cloudflare deployment failed: ${error}`)
      }

      const project = await response.json()
      return {
        url: `https://${config.projectName}.pages.dev`,
        id: project.result.id,
        status: "success",
      }
    } catch (error) {
      console.error("Cloudflare deployment error:", error)
      throw error
    }
  }
}
