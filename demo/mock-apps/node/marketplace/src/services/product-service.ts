import type { IProductStore } from '../domain/interfaces.js';
import type { Product, ProductCategory } from '../domain/types.js';

export interface ProductListParams {
  category?: ProductCategory;
  sortBy?: 'price' | 'rating' | 'newest';
  page?: number;
  pageSize?: number;
}

export interface ProductListResult {
  products: Product[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export class ProductService {
  constructor(private readonly productStore: IProductStore) {}

  async listProducts(params: ProductListParams): Promise<ProductListResult> {
    let products: Product[];

    if (params.category) {
      products = await this.productStore.getByCategory(params.category);
    } else {
      products = await this.productStore.getAll();
    }

    // Sort
    if (params.sortBy === 'price') {
      products.sort((a, b) => a.price - b.price);
    } else if (params.sortBy === 'rating') {
      products.sort((a, b) => b.rating - a.rating);
    } else {
      // Default: newest first (by createdAt descending)
      products.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    const totalCount = products.length;
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const start = (page - 1) * pageSize;
    const paged = products.slice(start, start + pageSize);

    return { products: paged, totalCount, page, pageSize };
  }

  async getProduct(id: string): Promise<Product | null> {
    return this.productStore.getById(id);
  }
}
