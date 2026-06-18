import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SetupProgress } from "@/components/setup/SetupProgress";
import type { SetupStep } from "@/components/setup/types";

type SetupPromptCardProps = {
  currentStep?: SetupStep;
};

export function SetupPromptCard({ currentStep = "company" }: SetupPromptCardProps) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Finish setting up Quotr</CardTitle>
        <CardDescription>
          Add your work areas and starter rates so Quotr can prepare more
          accurate estimates.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SetupProgress currentStep={currentStep} />
        <Button render={<Link href="/app/setup" />}>Continue setup</Button>
      </CardContent>
    </Card>
  );
}
