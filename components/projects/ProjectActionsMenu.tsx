"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Archive,
  Copy,
  MoreHorizontal,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { EditProjectDialog } from "@/components/projects/EditProjectDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  archiveProject,
  deleteProject,
  duplicateProject,
  restoreProject,
} from "@/lib/projects/lifecycle-actions";
import type { Project } from "@/lib/projects/types";

type ConfirmAction = "archive" | "delete" | null;

type ProjectActionsMenuProps = {
  project: Project;
  variant?: "header" | "card";
  showEdit?: boolean;
};

export function ProjectActionsMenu({
  project,
  variant = "header",
  showEdit = false,
}: ProjectActionsMenuProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [error, setError] = useState<string | null>(null);

  const isArchived = Boolean(project.archived_at);

  const runAction = (action: () => Promise<{ error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      setConfirmAction(null);
      router.refresh();
    });
  };

  const handleDuplicate = () => {
    setError(null);
    startTransition(async () => {
      await duplicateProject(project.id);
    });
  };

  const handleConfirm = () => {
    if (confirmAction === "archive") {
      runAction(() => archiveProject(project.id));
      return;
    }

    if (confirmAction === "delete") {
      startTransition(async () => {
        setError(null);
        const result = await deleteProject(project.id, {
          redirectToDashboard: variant === "header",
        });
        if (result.error) {
          setError(result.error);
        }
      });
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {showEdit ? <EditProjectDialog project={project} /> : null}
        <DropdownMenu>
          {variant === "card" ? (
            <DropdownMenuTrigger
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
              aria-label="Project actions"
              disabled={isPending}
              onClick={(event) => event.preventDefault()}
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
          ) : (
            <DropdownMenuTrigger
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
              disabled={isPending}
            >
              <MoreHorizontal className="size-4" />
              Actions
            </DropdownMenuTrigger>
          )}
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={handleDuplicate} disabled={isPending}>
              <Copy className="size-4" />
              Duplicate project
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {isArchived ? (
              <DropdownMenuItem
                onClick={() => runAction(() => restoreProject(project.id))}
                disabled={isPending}
              >
                <RotateCcw className="size-4" />
                Restore
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => setConfirmAction("archive")}
                disabled={isPending}
              >
                <Archive className="size-4" />
                Archive project
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setConfirmAction("delete")}
              disabled={isPending}
            >
              <Trash2 className="size-4" />
              Delete project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {error ? (
        <p className="mt-2 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Dialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmAction(null);
            setError(null);
          }
        }}
      >
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>
              {confirmAction === "archive"
                ? "Archive project?"
                : "Delete project?"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === "archive"
                ? "Archive this project? It will be hidden from active projects but can be restored later."
                : "Delete this project? This will hide it from your dashboard. This action can be reversed later by an administrator, but not from the app yet."}
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() => setConfirmAction(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={confirmAction === "delete" ? "destructive" : "default"}
              disabled={isPending}
              onClick={handleConfirm}
            >
              {isPending
                ? "Working…"
                : confirmAction === "archive"
                  ? "Archive project"
                  : "Delete project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
