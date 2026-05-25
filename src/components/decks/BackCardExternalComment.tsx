export type BackCardExternalCommentItem = {
  id: string;
  text: string;
  author: string;
};

type BackCardExternalCommentProps = {
  className?: string;
  comment?: BackCardExternalCommentItem | null;
};

export default function BackCardExternalComment({ className, comment }: BackCardExternalCommentProps) {
  if (!comment) {
    return null;
  }

  const commentClassName = ["focused-card-back-external-comment", className].filter(Boolean).join(" ");

  return (
    <aside className={commentClassName} aria-label={`Retained observation from ${comment.author}`}>
      <p>{comment.text}</p>
      <span>{comment.author}</span>
    </aside>
  );
}
