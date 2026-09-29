export default function Link({
  children,
  href,
}: {
  children?: React.ReactNode;
  href?: string;
}) {
  return <a href={href}>{children}</a>;
}
