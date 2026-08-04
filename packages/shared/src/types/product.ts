import type { Color } from './color';
import type { Category } from './category';
import type { ProductImage } from './product-image';

export type { Category, ProductImage };

export interface ProductColor {
  id: number;
  productId: number;
  colorId: number;
  color: Color;
  weightGrams: number;
  sortOrder: number;
}

export interface ProductColorDto {
  colorId: number;
  weightGrams: number;
  sortOrder: number;
}

export interface Product {
  id: number;
  name: string;
  description: string | null;
  sku: string | null;
  unitsSold: number;
  active: boolean;
  totalWeightGrams: number;
  colors: ProductColor[];
  // Publishing flags + audience-segmented pricing (BP #19 consolidated
  // these from the old name/storeTitle, description/storeDescription,
  // unitPrice/wholesalePrice/retailPrice trio — single source per piece).
  publishedToStore: boolean;
  publishedToWholesale: boolean;
  categoryId: number | null;
  category: Category | null;
  wholesalePrice: number;
  retailPrice: number;
  // Allowed material family tokens for the storefront color picker
  // (e.g. ['pla'], ['pla', 'petg']). Empty array = no constraint, all
  // materials allowed. Picker UI restricts the material dropdown to
  // these; backend `POST /api/store/orders` rejects line items whose
  // picked color's material family isn't in this list. Mirrors the
  // dedupe-tool's family extraction so "PLA Basic" / "PLA-CF" both
  // satisfy 'pla'.
  allowedMaterials: string[];
  images: ProductImage[];
  // Facebook Page post marker (Change #442). `facebookPostId` non-null means
  // this product has been posted; it also gates the publish-time auto-post so
  // a product is never posted twice by accident.
  facebookPostId: string | null;
  facebookPostedAt: string | null;
  /**
   * TRANSIENT — never stored, never returned by a plain read. Set only on a
   * save response when a publish-time Facebook post was attempted and failed,
   * so the admin form can show the Graph error instead of silently dropping
   * it. The save itself still succeeded.
   */
  facebookError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductDto {
  name: string;
  description?: string;
  sku?: string;
  // Both prices required for new products — wholesale + retail are the
  // two distinct audiences. Use the same value for both if you don't
  // distinguish (e.g. retail-only catalog).
  wholesalePrice: number;
  retailPrice: number;
  active?: boolean;
  publishedToStore?: boolean;
  publishedToWholesale?: boolean;
  categoryId?: number | null;
  allowedMaterials?: string[];
}

export interface UpdateProductDto {
  name?: string;
  description?: string;
  sku?: string;
  active?: boolean;
  publishedToStore?: boolean;
  publishedToWholesale?: boolean;
  categoryId?: number | null;
  wholesalePrice?: number;
  retailPrice?: number;
  allowedMaterials?: string[];
  /**
   * Change #442 — transient request flag, not a column. When true, a save
   * that flips this product from unpublished to live on the webstore also
   * posts it to the Facebook Page (once — skipped if already posted).
   */
  postToFacebook?: boolean;
}
