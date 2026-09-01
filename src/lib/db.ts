import Database from "@tauri-apps/plugin-sql";

let dbPromise: Promise<Database> | null = null;

/**
 * Singleton connection to the single aurafit.db file (WAL mode).
 * Migrations (schema + USDA seed) run automatically on first load.
 */
export function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load("sqlite:aurafit.db");
  }
  return dbPromise;
}

export type FoodItem = {
  fdc_id: number;
  description: string;
  category: string | null;
  calories_per_100g: number;
  protein_g_per_100g: number;
  carbs_g_per_100g: number;
  fat_g_per_100g: number;
  fiber_g_per_100g: number | null;
};

/**
 * Sub-5ms indexed full-text search against the pre-seeded usda_foods table
 * (Backend & Database Schema doc, 06 — Indexing & Performance).
 */
function toFtsPrefixQuery(raw: string): string | null {
  const terms = raw
    .split(/[^a-zA-Z0-9]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (terms.length === 0) return null;
  return terms.map((t) => `${t}*`).join(" ");
}

export async function searchUsdaFoods(query: string, limit = 20): Promise<FoodItem[]> {
  const ftsQuery = toFtsPrefixQuery(query);
  if (!ftsQuery) return [];

  const db = await getDb();
  return db.select<FoodItem[]>(
    `SELECT f.fdc_id, f.description, f.category, f.calories_per_100g,
            f.protein_g_per_100g, f.carbs_g_per_100g, f.fat_g_per_100g, f.fiber_g_per_100g
     FROM usda_foods_fts
     JOIN usda_foods f ON f.fdc_id = usda_foods_fts.rowid
     WHERE usda_foods_fts MATCH $1
     ORDER BY rank
     LIMIT $2`,
    [ftsQuery, limit]
  );
}
