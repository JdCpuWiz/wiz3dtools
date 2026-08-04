import { ProductModel } from '../models/product.model.js';
import { ProductColorModel } from '../models/product-color.model.js';
import { isFacebookConfigured, postToPage } from './facebook.service.js';
import type { Product, CreateProductDto, UpdateProductDto } from '@wizqueue/shared';

// Public storefront root — the PDP link that goes in every Facebook caption.
// Overridable so a staging storefront doesn't advertise production URLs.
const STORE_PUBLIC_URL = (process.env.STORE_PUBLIC_URL || 'https://wiz3dprints.com').replace(/\/$/, '');
const IMAGE_PUBLIC_BASE = (process.env.STORE_IMAGE_PUBLIC_BASE || '').replace(/\/$/, '');

/** PDP link for a product on the public storefront. */
function productUrl(product: Product): string {
  return `${STORE_PUBLIC_URL}/shop/${product.id}`;
}

/**
 * Absolute, publicly-reachable URL of the product's primary image — Facebook
 * fetches it server-side, so a relative path or a LAN-only host is useless.
 * Returns null when there's nothing postable, which downgrades the post to the
 * text+link fallback rather than failing it.
 */
function primaryImageUrl(product: Product): string | null {
  const images = product.images ?? [];
  const primary = images.find((img) => img.isPrimary) ?? images[0];
  if (!primary?.url) return null;
  if (/^https?:\/\//i.test(primary.url)) return primary.url;
  if (!IMAGE_PUBLIC_BASE || !/^https?:\/\//i.test(IMAGE_PUBLIC_BASE)) return null;
  return `${IMAGE_PUBLIC_BASE}/${primary.url.split('/').pop()}`;
}

/** Caption: name, a trimmed description, then the PDP link. */
function buildCaption(product: Product): string {
  const parts = [product.name.trim()];
  const description = (product.description ?? '').trim();
  if (description) {
    parts.push(description.length > 500 ? `${description.slice(0, 497).trimEnd()}…` : description);
  }
  parts.push(productUrl(product));
  return parts.join('\n\n');
}

export class ProductService {
  async getAll(activeOnly = false): Promise<Product[]> {
    return ProductModel.findAll(activeOnly);
  }

  async getById(id: number): Promise<Product> {
    const product = await ProductModel.findById(id);
    if (!product) throw new Error('Product not found');
    return product;
  }

  async create(data: CreateProductDto): Promise<Product> {
    return ProductModel.create(data);
  }

  async update(id: number, data: UpdateProductDto): Promise<Product> {
    // Change #442 — `postToFacebook` is a request flag, not a column. Strip it
    // here so nothing downstream mistakes it for a field to persist.
    const { postToFacebook, ...changes } = data;

    // The auto-post fires only on the unpublished → live TRANSITION, so we
    // need the pre-update state. Read it before anything mutates.
    const before = postToFacebook ? await ProductModel.findById(id) : null;

    // Wholesale-storefront invariant: a product visible to wholesale buyers
    // (published_to_store=TRUE AND active=TRUE) MUST have ≥1 product_colors
    // recipe slot. Without one, StoreService.createOrder rejects orders for
    // it and the storefront filters it out — net effect was a published
    // product that customers never see, with no warning. Enforce here when
    // a request would push the product INTO the visible state.
    if (data.publishedToStore === true || data.active === true) {
      const current = await ProductModel.findById(id);
      if (!current) throw new Error('Product not found');
      const wouldBePublished = data.publishedToStore ?? current.publishedToStore;
      const wouldBeActive = data.active ?? current.active;
      if (wouldBePublished && wouldBeActive) {
        const recipe = await ProductColorModel.findByProduct(id);
        if (recipe.length === 0) {
          throw Object.assign(
            new Error(
              'Cannot publish this product to the wholesale store without at least one recipe slot. Add a color to the recipe first, or uncheck "Published to store".',
            ),
            { statusCode: 400 },
          );
        }
      }
    }

    const product = await ProductModel.update(id, changes);
    if (!product) throw new Error('Product not found');

    // Change #442 — publish-time Facebook post. Three guards, all deliberate:
    //   • the admin ticked the box on THIS save;
    //   • this save is the unpublished → live transition (so re-saving a
    //     already-live product never re-posts);
    //   • the product is actually visible (active), and has never been posted.
    // Failure is LOUD but NON-FATAL: the save already happened, the marker
    // stays null, and the error rides back on the response so the form can
    // show it and the "Post to Facebook" button becomes the retry.
    const wentLive = !!before && !before.publishedToStore && product.publishedToStore && product.active;
    if (postToFacebook && wentLive && !product.facebookPostId) {
      try {
        return await this.postToFacebook(id);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Facebook post failed';
        console.error(`[facebook] publish-time post failed for product ${id}:`, message);
        return { ...product, facebookError: message };
      }
    }

    return product;
  }

  /**
   * Change #442 — post a product to the Facebook Page and stamp the marker.
   * Throws (with the Graph message intact) on any failure so both callers can
   * decide: the publish path swallows it into `facebookError`, the explicit
   * admin button turns it into a visible error response.
   *
   * `force` is the re-post path (the admin confirmed) — it clears the guard
   * and re-stamps the marker with the new post's id.
   */
  async postToFacebook(id: number, force = false): Promise<Product> {
    if (!isFacebookConfigured()) {
      throw Object.assign(
        new Error('Facebook posting is not configured on this server — FACEBOOK_PAGE_ID / FACEBOOK_PAGE_TOKEN are unset.'),
        { statusCode: 503 },
      );
    }

    const product = await ProductModel.findById(id);
    if (!product) throw new Error('Product not found');
    if (product.facebookPostId && !force) {
      throw Object.assign(
        new Error('This product has already been posted to Facebook. Confirm a re-post to post it again.'),
        { statusCode: 409 },
      );
    }

    const { postId } = await postToPage({
      message: buildCaption(product),
      imageUrl: primaryImageUrl(product),
      link: productUrl(product),
    });

    const stamped = await ProductModel.setFacebookPost(id, postId);
    if (!stamped) throw new Error('Product not found');
    return stamped;
  }

  async delete(id: number): Promise<void> {
    const deleted = await ProductModel.delete(id);
    if (!deleted) throw new Error('Product not found');
  }

  async copy(id: number): Promise<Product> {
    const original = await ProductModel.findById(id);
    if (!original) throw new Error('Product not found');

    const copyName = `Copy of ${original.name}`;
    const newSku = await ProductModel.suggestSku(copyName);

    const copy = await ProductModel.create({
      name: copyName,
      description: original.description ?? undefined,
      sku: newSku,
      wholesalePrice: original.wholesalePrice,
      retailPrice: original.retailPrice,
      active: false,
    });

    if (original.colors.length > 0) {
      await ProductColorModel.setColors(
        copy.id,
        original.colors.map((c) => ({
          colorId: c.colorId,
          weightGrams: c.weightGrams,
          sortOrder: c.sortOrder,
        })),
      );
      return (await ProductModel.findById(copy.id))!;
    }

    return copy;
  }

  async suggestSku(name: string, excludeId?: number): Promise<string> {
    return ProductModel.suggestSku(name, excludeId);
  }
}
