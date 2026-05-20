export type BackCardExternalCommentItem = {
  id: string;
  text: string;
  author: string;
};

type BackCardExternalCommentProps = {
  comment?: BackCardExternalCommentItem | null;
};

export default function BackCardExternalComment({ comment }: BackCardExternalCommentProps) {
  if (!comment) {
    return null;
  }

  return (
    <aside className="focused-card-back-external-comment" aria-label={`Retained observation from ${comment.author}`}>
      <p>{comment.text}</p>
      <span>{comment.author}</span>
    </aside>
  );
}
