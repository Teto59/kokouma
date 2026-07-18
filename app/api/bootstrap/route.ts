import { ensureDatabase, getCurrentUser, publicUser } from "../../../lib/server";
import { reviewVisibilityBindings, reviewVisibilitySql } from "../../../lib/visibility";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const DB = await ensureDatabase();
  const currentUser = await getCurrentUser(request);
  const visibilitySql = reviewVisibilitySql("r");
  const visibilityBindings = reviewVisibilityBindings(currentUser?.id ?? null);
  const productVisibilitySql = reviewVisibilitySql("pr");
  const [usersResult, placesResult, reviewsResult, tiersResult, followsResult, brandsResult, productsResult, productReviewsResult, productWantsResult] = await Promise.all([
    DB.prepare(`SELECT id,handle,display_name as displayName,bio,avatar_color as avatarColor,is_seed as isSeed,is_unofficial as isUnofficial FROM users ORDER BY is_unofficial, display_name`).all(),
    DB.prepare(`SELECT p.*, p.google_maps_url as googleMapsUrl,p.image_url as imageUrl,p.image_key as imageKey,p.created_by as createdBy,p.is_seed as isSeed,p.created_at as createdAt, ROUND(COALESCE(AVG(r.rating),0),1) as averageRating, COUNT(r.id) as reviewCount FROM places p LEFT JOIN reviews r ON r.place_id=p.id AND ${visibilitySql} GROUP BY p.id ORDER BY p.is_seed DESC,p.created_at DESC`).bind(...visibilityBindings).all(),
    DB.prepare(`SELECT r.id,r.user_id as userId,r.place_id as placeId,r.rating,r.body,r.image_key as imageKey,r.visibility,r.is_seed as isSeed,r.is_fictional_demo as isFictionalDemo,r.created_at as createdAt,u.handle,u.display_name as displayName,u.avatar_color as avatarColor,u.is_unofficial as isUnofficial FROM reviews r JOIN users u ON u.id=r.user_id WHERE ${visibilitySql} ORDER BY r.created_at DESC`).bind(...visibilityBindings).all(),
    DB.prepare(`SELECT user_id as userId,place_id as placeId,tier,position,is_seed as isSeed FROM tier_entries ORDER BY tier,position`).all(),
    DB.prepare(`SELECT follower_id as followerId,following_id as followingId FROM follows`).all(),
    DB.prepare(`SELECT id,name,slug,accent_color as accentColor,maps_query as mapsQuery,is_seed as isSeed FROM brands ORDER BY name`).all(),
    DB.prepare(`SELECT p.id,p.brand_id as brandId,p.name,p.normalized_name as normalizedName,p.is_limited as isLimited,p.release_date as releaseDate,p.official_url as officialUrl,p.image_url as imageUrl,p.image_key as imageKey,p.created_by as createdBy,p.is_seed as isSeed,p.created_at as createdAt,b.name as brandName,b.accent_color as accentColor,b.maps_query as mapsQuery,ROUND(COALESCE(AVG(pr.rating),0),1) as averageRating,COUNT(DISTINCT pr.id) as reviewCount,COUNT(DISTINCT pw.user_id) as wantCount FROM products p JOIN brands b ON b.id=p.brand_id LEFT JOIN product_reviews pr ON pr.product_id=p.id AND ${productVisibilitySql} LEFT JOIN product_wants pw ON pw.product_id=p.id GROUP BY p.id ORDER BY p.created_at DESC`).bind(...visibilityBindings).all(),
    DB.prepare(`SELECT pr.id,pr.user_id as userId,pr.product_id as productId,pr.rating,pr.body,pr.tier,pr.visibility,pr.image_url as imageUrl,pr.image_key as imageKey,pr.store_name as storeName,pr.store_maps_url as storeMapsUrl,pr.is_seed as isSeed,pr.created_at as createdAt,u.handle,u.display_name as displayName,u.avatar_color as avatarColor,u.is_unofficial as isUnofficial FROM product_reviews pr JOIN users u ON u.id=pr.user_id WHERE ${productVisibilitySql} ORDER BY pr.created_at DESC`).bind(...visibilityBindings).all(),
    DB.prepare(`SELECT user_id as userId,product_id as productId FROM product_wants`).all(),
  ]);

  return Response.json({
    currentUser,
    users: usersResult.results.map((row: Record<string, unknown>) => publicUser(row)),
    places: placesResult.results.map((row: Record<string, unknown>) => ({ ...row, isSeed: Boolean(row.isSeed) })),
    reviews: reviewsResult.results.map((row: Record<string, unknown>) => ({ ...row, isSeed: Boolean(row.isSeed), isFictionalDemo: Boolean(row.isFictionalDemo), isUnofficial: Boolean(row.isUnofficial) })),
    tiers: tiersResult.results.map((row: Record<string, unknown>) => ({ ...row, isSeed: Boolean(row.isSeed) })),
    follows: followsResult.results,
    brands: brandsResult.results.map((row: Record<string, unknown>) => ({ ...row, isSeed: Boolean(row.isSeed) })),
    products: productsResult.results.map((row: Record<string, unknown>) => ({ ...row, isLimited: Boolean(row.isLimited), isSeed: Boolean(row.isSeed) })),
    productReviews: productReviewsResult.results.map((row: Record<string, unknown>) => ({ ...row, isSeed: Boolean(row.isSeed), isUnofficial: Boolean(row.isUnofficial) })),
    productWants: productWantsResult.results,
  });
}
