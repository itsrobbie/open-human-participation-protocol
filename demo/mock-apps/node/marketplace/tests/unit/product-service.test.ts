import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProductService } from '../../src/services/product-service.js';
import type { IProductStore } from '../../src/domain/interfaces.js';
import type { Product, ProductCategory } from '../../src/domain/types.js';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    sellerId: 'seller-1',
    name: 'Test Product',
    description: 'A test product',
    price: 4999,
    category: 'electronics',
    stock: 10,
    rating: 4.5,
    reviewCount: 100,
    bundleEligible: false,
    createdAt: '2026-01-01T10:00:00Z',
    ...overrides,
  };
}

function createMockProductStore(products: Product[] = []): IProductStore {
  return {
    getAll: vi.fn(async () => products),
    getById: vi.fn(async (id: string) => products.find((p) => p.id === id) ?? null),
    getByCategory: vi.fn(async (cat: string) => products.filter((p) => p.category === cat)),
    decrementStock: vi.fn(async () => true),
  };
}

describe('ProductService', () => {
  const products: Product[] = [
    makeProduct({ id: 'p1', name: 'Alpha', price: 5000, category: 'electronics', rating: 4.2, stock: 10 }),
    makeProduct({ id: 'p2', name: 'Beta', price: 2000, category: 'clothing', rating: 4.8, stock: 5 }),
    makeProduct({ id: 'p3', name: 'Gamma', price: 8000, category: 'electronics', rating: 4.5, stock: 0 }),
    makeProduct({ id: 'p4', name: 'Delta', price: 1000, category: 'books', rating: 3.9, stock: 20 }),
    makeProduct({ id: 'p5', name: 'Epsilon', price: 3000, category: 'electronics', rating: 4.0, stock: 8 }),
    makeProduct({ id: 'p6', name: 'Zeta', price: 4500, category: 'home', rating: 4.7, stock: 15 }),
  ];

  let productStore: IProductStore;
  let service: ProductService;

  beforeEach(() => {
    productStore = createMockProductStore(products);
    service = new ProductService(productStore);
  });

  describe('listProducts', () => {
    it('returnsAllAvailable', async () => {
      const result = await service.listProducts({});
      expect(result.products.length).toBe(6);
    });

    it('filterByCategory_returnsFiltered', async () => {
      const result = await service.listProducts({ category: 'electronics' });
      expect(result.products.every((p) => p.category === 'electronics')).toBe(true);
      expect(result.products.length).toBe(3);
    });

    it('sortByPrice_returnsSorted', async () => {
      const result = await service.listProducts({ sortBy: 'price' });
      for (let i = 1; i < result.products.length; i++) {
        expect(result.products[i].price).toBeGreaterThanOrEqual(result.products[i - 1].price);
      }
    });

    it('sortByRating_returnsSorted', async () => {
      const result = await service.listProducts({ sortBy: 'rating' });
      for (let i = 1; i < result.products.length; i++) {
        expect(result.products[i].rating).toBeLessThanOrEqual(result.products[i - 1].rating);
      }
    });

    it('pagination_returnsCorrectPage', async () => {
      const result = await service.listProducts({ page: 2, pageSize: 2 });
      expect(result.products.length).toBe(2);
      expect(result.totalCount).toBe(6);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(2);
    });
  });

  describe('getProduct', () => {
    it('existingId_returnsProduct', async () => {
      const result = await service.getProduct('p1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('p1');
    });

    it('unknownId_returnsNull', async () => {
      const result = await service.getProduct('nonexistent');
      expect(result).toBeNull();
    });

    it('outOfStock_stillReturnsProduct', async () => {
      const result = await service.getProduct('p3');
      expect(result).not.toBeNull();
      expect(result!.stock).toBe(0);
    });
  });
});
