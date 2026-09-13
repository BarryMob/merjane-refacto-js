import {type Cradle} from '@fastify/awilix';
import {eq} from 'drizzle-orm';
import {products, type Product} from '@/db/schema.js';
import {type Database} from '@/db/type.js';

/** Every write to the products table goes through here. */
export class ProductRepository {
	private readonly db: Database;

	public constructor({db}: Pick<Cradle, 'db'>) {
		this.db = db;
	}

	/** Takes one unit of the product out of the stock. */
	public async decrementStock(product: Product): Promise<void> {
		await this.db
			.update(products)
			.set({available: product.available - 1})
			.where(eq(products.id, product.id));
	}

	/** Empties the stock of a product that can no longer be sold. */
	public async markAsUnavailable(product: Product): Promise<void> {
		await this.db
			.update(products)
			.set({available: 0})
			.where(eq(products.id, product.id));
	}
}
