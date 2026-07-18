import { ensureDatabase, getCurrentUser, publicUser } from "../../../lib/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const DB = await ensureDatabase();
  const currentUser = await getCurrentUser(request);
  const [usersResult, placesResult, reviewsResult, tiersResult, followsResult] = await Promise.all([
    DB.prepare(`SELECT id,handle,display_name as displayName,bio,avatar_color as avatarColor,is_seed as isSeed,is_unofficial as isUnofficial FROM users ORDER BY is_unofficial, display_name`).all(),
    DB.prepare(`SELECT p.*, p.google_maps_url as googleMapsUrl,p.image_url as imageUrl,p.image_key as imageKey,p.created_by as createdBy,p.is_seed as isSeed,p.created_at as createdAt, ROUND(COALESCE(AVG(r.rating),0),1) as averageRating, COUNT(r.id) as reviewCount FROM places p LEFT JOIN reviews r ON r.place_id=p.id GROUP BY p.id ORDER BY p.is_seed DESC,p.created_at DESC`).all(),
    DB.prepare(`SELECT r.id,r.user_id as userId,r.place_id as placeId,r.rating,r.body,r.image_key as imageKey,r.is_seed as isSeed,r.is_fictional_demo as isFictionalDemo,r.created_at as createdAt,u.handle,u.display_name as displayName,u.avatar_color as avatarColor,u.is_unofficial as isUnofficial FROM reviews r JOIN users u ON u.id=r.user_id ORDER BY r.created_at DESC`).all(),
    DB.prepare(`SELECT user_id as userId,place_id as placeId,tier,position,is_seed as isSeed FROM tier_entries ORDER BY tier,position`).all(),
    DB.prepare(`SELECT follower_id as followerId,following_id as followingId FROM follows`).all(),
  ]);

  return Response.json({
    currentUser,
    users: usersResult.results.map((row: Record<string, unknown>) => publicUser(row)),
    places: placesResult.results.map((row: Record<string, unknown>) => ({ ...row, isSeed: Boolean(row.isSeed) })),
    reviews: reviewsResult.results.map((row: Record<string, unknown>) => ({ ...row, isSeed: Boolean(row.isSeed), isFictionalDemo: Boolean(row.isFictionalDemo), isUnofficial: Boolean(row.isUnofficial) })),
    tiers: tiersResult.results.map((row: Record<string, unknown>) => ({ ...row, isSeed: Boolean(row.isSeed) })),
    follows: followsResult.results,
  });
}
