import {type Cradle} from '@fastify/awilix';
import {eq} from 'drizzle-orm';
import {orders, type Order, type Product} from '@/db/schema.js';
import {type Database} from '@/db/type.js';

export type OrderWithProducts = Order & {
	products: Array<{product: Product}>;
};

/** Every read of the orders table goes through here. */
export class OrderRepository {
	private readonly db: Database;

	public constructor({db}: Pick<Cradle, 'db'>) {
		this.db = db;
	}

	public async findByIdWithProducts(orderId: number): Promise<OrderWithProducts | undefined> {
		return this.db.query.orders.findFirst({
			where: eq(orders.id, orderId),
			with: {
				products: {
					columns: {},
					with: {product: true},
				},
			},
		});
	}
}
