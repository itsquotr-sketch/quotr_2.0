import { ProjectInformationWorkspace } from "@/components/projects/information/ProjectInformationWorkspace";
import {
  WorkspaceHeaderBar,
  WorkspacePage,
} from "@/components/layout/workspace-page";
import { UserMenu } from "@/components/layout/user-menu";
import { ProjectWorkspaceHeader } from "@/components/projects/ProjectWorkspaceHeader";
import { getAssistantStateWithContext } from "@/lib/assistant/state";
import { projectInformationFromLoaded } from "@/lib/projects/project-information";
import { getProjectWithContext } from "@/lib/projects/project-loaders";
import { requireAuthOrgContext } from "@/lib/security/auth-org-context";
import { notFound } from "next/navigation";
import { connection } from "next/server";

type ProjectInformationPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectInformationPage({
  params,
}: ProjectInformationPageProps) {
  await connection();
  const { projectId } = await params;
  const auth = await requireAuthOrgContext();
  if (!auth.ok) {
    notFound();
  }

  const [project, assistant] = await Promise.all([
    getProjectWithContext(auth, projectId),
    getAssistantStateWithContext(auth, projectId),
  ]);

  const model = projectInformationFromLoaded(project, assistant, projectId);

  return (
    <WorkspacePage
      header={
        <WorkspaceHeaderBar actions={<UserMenu />}>
          <ProjectWorkspaceHeader project={project} />
        </WorkspaceHeaderBar>
      }
    >
      <ProjectInformationWorkspace model={model} />
    </WorkspacePage>
  );
}
