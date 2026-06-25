import { cn } from "@/lib/utils";

const WIDTH = {
  page: "max-w-[1440px]",
  workspace: "max-w-[1500px]",
  settings: "max-w-[1024px]",
  form: "max-w-[880px]",
} as const;

export const LAYOUT_MAX_WIDTH = WIDTH;

type ContainerVariant = keyof typeof WIDTH;

type PageContainerProps = {
  children: React.ReactNode;
  variant?: ContainerVariant;
  className?: string;
  innerClassName?: string;
  scrollable?: boolean;
};

function PageContainer({
  children,
  variant = "page",
  className,
  innerClassName,
  scrollable = true,
}: PageContainerProps) {
  return (
    <div
      className={cn(
        scrollable && "flex-1 overflow-auto overflow-x-hidden",
        className
      )}
    >
      <div
        className={cn(
          "mx-auto w-full px-4 py-6 sm:px-6 lg:px-8",
          WIDTH[variant],
          innerClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function WorkspaceContainer(props: Omit<PageContainerProps, "variant">) {
  return <PageContainer {...props} variant="workspace" />;
}

export function SettingsContainer(props: Omit<PageContainerProps, "variant">) {
  return <PageContainer {...props} variant="settings" />;
}

export function FormContainer(props: Omit<PageContainerProps, "variant">) {
  return <PageContainer {...props} variant="form" />;
}

export { PageContainer };
