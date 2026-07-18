import { integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  handle: text("handle").notNull().unique(),
  displayName: text("display_name").notNull(),
  bio: text("bio").notNull().default(""),
  avatarColor: text("avatar_color").notNull().default("#ff5a36"),
  isSeed: integer("is_seed", { mode: "boolean" }).notNull().default(false),
  isUnofficial: integer("is_unofficial", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
});

export const credentials = sqliteTable("credentials", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  salt: text("salt").notNull(),
  passwordHash: text("password_hash").notNull(),
});

export const sessions = sqliteTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const follows = sqliteTable("follows", {
  followerId: text("follower_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  followingId: text("following_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at").notNull(),
}, (table) => [primaryKey({ columns: [table.followerId, table.followingId] })]);

export const places = sqliteTable("places", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  area: text("area").notNull(),
  category: text("category").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  googleMapsUrl: text("google_maps_url").notNull(),
  imageUrl: text("image_url"),
  imageKey: text("image_key"),
  createdBy: text("created_by").notNull().references(() => users.id),
  isSeed: integer("is_seed", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
}, (table) => [uniqueIndex("places_maps_url_unique").on(table.googleMapsUrl)]);

export const reviews = sqliteTable("reviews", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  placeId: text("place_id").notNull().references(() => places.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(),
  body: text("body").notNull(),
  imageKey: text("image_key"),
  isSeed: integer("is_seed", { mode: "boolean" }).notNull().default(false),
  isFictionalDemo: integer("is_fictional_demo", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
}, (table) => [uniqueIndex("reviews_user_place_unique").on(table.userId, table.placeId)]);

export const tierEntries = sqliteTable("tier_entries", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  placeId: text("place_id").notNull().references(() => places.id, { onDelete: "cascade" }),
  tier: text("tier", { enum: ["S", "A", "B", "C"] }).notNull(),
  position: integer("position").notNull().default(0),
  isSeed: integer("is_seed", { mode: "boolean" }).notNull().default(false),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.placeId] })]);

export const geocodeCache = sqliteTable("geocode_cache", {
  query: text("query").primaryKey(),
  payload: text("payload").notNull(),
  createdAt: integer("created_at").notNull(),
});
