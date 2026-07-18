export const reviewVisibilities = ["public", "following", "mutual"] as const;

export type ReviewVisibility = (typeof reviewVisibilities)[number];

export function isReviewVisibility(value: unknown): value is ReviewVisibility {
  return typeof value === "string" && reviewVisibilities.includes(value as ReviewVisibility);
}

export function canViewReview(
  visibility: ReviewVisibility,
  authorId: string,
  viewerId: string | null,
  follows: ReadonlyArray<{ followerId: string; followingId: string }>,
) {
  if (visibility === "public") return true;
  if (!viewerId) return false;
  if (viewerId === authorId) return true;
  const authorFollowsViewer = follows.some((follow) => follow.followerId === authorId && follow.followingId === viewerId);
  if (!authorFollowsViewer) return false;
  if (visibility === "following") return true;
  return follows.some((follow) => follow.followerId === viewerId && follow.followingId === authorId);
}

export function reviewVisibilitySql(alias = "r") {
  return `(${alias}.visibility='public' OR ${alias}.user_id=? OR (${alias}.visibility='following' AND EXISTS (SELECT 1 FROM follows audience_follow WHERE audience_follow.follower_id=${alias}.user_id AND audience_follow.following_id=?)) OR (${alias}.visibility='mutual' AND EXISTS (SELECT 1 FROM follows author_follow WHERE author_follow.follower_id=${alias}.user_id AND author_follow.following_id=?) AND EXISTS (SELECT 1 FROM follows viewer_follow WHERE viewer_follow.follower_id=? AND viewer_follow.following_id=${alias}.user_id)))`;
}

export function reviewVisibilityBindings(viewerId: string | null) {
  const id = viewerId ?? "";
  return [id, id, id, id] as const;
}
