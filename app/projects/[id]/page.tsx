import { ProjectDetails } from "@/components/project-details"
import { WebContainerPreview } from "@/components/webcontainer-preview"
import { Shell } from "@/components/shell"
import { Separator } from "@/components/ui/separator"
import { db } from "@/lib/db"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

interface Props {
  params: {
    id: string
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = await db.project.findUnique({
    where: {
      id: params.id,
    },
  })

  if (!project) {
    return {
      title: "Project Not Found",
    }
  }

  return {
    title: project.name,
  }
}

export default async function ProjectPage({ params }: Props) {
  const project = await db.project.findUnique({
    where: {
      id: params.id,
    },
  })

  if (!project) {
    notFound()
  }

  return (
    <div className="container relative pb-16">
      <div className="flex flex-col gap-4">
        <ProjectDetails project={project} />
        <Separator />
        <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight transition-colors first:mt-0">
          Preview
        </h2>
        <WebContainerPreview projectId={project.id} />
        <Separator />
        <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight transition-colors first:mt-0">
          Shell
        </h2>
        <Shell projectId={project.id} />
      </div>
    </div>
  )
}
