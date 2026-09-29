export default function Image(props: { alt?: string }) {
  return <span role="img" aria-label={props.alt || undefined} />;
}
