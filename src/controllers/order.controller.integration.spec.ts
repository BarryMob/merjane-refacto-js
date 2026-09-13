import {
	describe, it, expect, beforeEach,
	afterEach,
} from 'vitest';
import {type FastifyInstance} from 'fastify';
import supertest from 'supertest';
import {inArray} from 'drizzle-orm';
import {type DeepMockProxy, mockDeep} from 'vitest-mock-extended';
import {asValue} from 'awilix';
import {type INotificationService} from '@/services/notifications.port.js';
import {
	type Product,
	type ProductInsert,
	type ProductType,
	products,
	orders,
	ordersToProducts,
} from '@/db/schema.js';
import {type Database} from '@/db/type.js';
import {buildFastify} from '@/fastify.js';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + (days * DAY_IN_MS));

describe('POST /orders/:orderId/processOrder', () => {
	let fastify: FastifyInstance;
	let database: Database;
	let notifications: DeepMockProxy<INotificationService>;

	beforeEach(async () => {
		notifications = mockDeep<INotificationService>();

		fastify = await buildFastify();
		fastify.diContainer.register({
			notificationService: asValue(notifications as INotificationService),
		});
		await fastify.ready();
		database = fastify.database;
	});

	afterEach(async () => {
		await fastify.close();
	});

	describe('NORMAL products', () => {
		it('decrements the stock when the product is available', async () => {
			const product = await processOrderOf({
				type: 'NORMAL', name: 'USB Cable', available: 30, leadTime: 15,
			});

			expect(product.available).toBe(29);
			expectNoNotification();
		});

		it('announces the restocking delay when out of stock', async () => {
			const product = await processOrderOf({
				type: 'NORMAL', name: 'USB Dongle', available: 0, leadTime: 10,
			});

			expect(product.available).toBe(0);
			expect(notifications.sendDelayNotification).toHaveBeenCalledWith(10, 'USB Dongle');
		});

		// Characterises existing behaviour: a zero lead time silently notifies nothing.
		it('notifies nothing when out of stock without a lead time', async () => {
			const product = await processOrderOf({
				type: 'NORMAL', name: 'Ethernet Cable', available: 0, leadTime: 0,
			});

			expect(product.available).toBe(0);
			expectNoNotification();
		});
	});

	describe('SEASONAL products', () => {
		it('decrements the stock when in season and available', async () => {
			const product = await processOrderOf({
				type: 'SEASONAL',
				name: 'Watermelon',
				available: 30,
				leadTime: 15,
				seasonStartDate: inDays(-2),
				seasonEndDate: inDays(58),
			});

			expect(product.available).toBe(29);
			expectNoNotification();
		});

		it('announces the restocking delay when out of stock and restocking lands within the season', async () => {
			const product = await processOrderOf({
				type: 'SEASONAL',
				name: 'Strawberry',
				available: 0,
				leadTime: 15,
				seasonStartDate: inDays(-2),
				seasonEndDate: inDays(58),
			});

			expect(product.available).toBe(0);
			expect(notifications.sendDelayNotification).toHaveBeenCalledWith(15, 'Strawberry');
		});

		it('declares the product unavailable when restocking would land after the season ends', async () => {
			const product = await processOrderOf({
				type: 'SEASONAL',
				name: 'Cherry',
				available: 0,
				leadTime: 90,
				seasonStartDate: inDays(-2),
				seasonEndDate: inDays(58),
			});

			expect(product.available).toBe(0);
			expect(notifications.sendOutOfStockNotification).toHaveBeenCalledWith('Cherry');
		});

		it('declares the product unavailable when the season has not started yet, leaving the stock untouched', async () => {
			const product = await processOrderOf({
				type: 'SEASONAL',
				name: 'Grapes',
				available: 30,
				leadTime: 15,
				seasonStartDate: inDays(180),
				seasonEndDate: inDays(240),
			});

			expect(product.available).toBe(30);
			expect(notifications.sendOutOfStockNotification).toHaveBeenCalledWith('Grapes');
		});

		it('declares the product unavailable and empties the stock when the season is over', async () => {
			const product = await processOrderOf({
				type: 'SEASONAL',
				name: 'Pumpkin',
				available: 30,
				leadTime: 15,
				seasonStartDate: inDays(-100),
				seasonEndDate: inDays(-10),
			});

			expect(product.available).toBe(0);
			expect(notifications.sendOutOfStockNotification).toHaveBeenCalledWith('Pumpkin');
		});
	});

	describe('EXPIRABLE products', () => {
		it('decrements the stock while the product has not expired', async () => {
			const product = await processOrderOf({
				type: 'EXPIRABLE', name: 'Butter', available: 30, leadTime: 15, expiryDate: inDays(26),
			});

			expect(product.available).toBe(29);
			expectNoNotification();
		});

		it('empties the stock and notifies the expiration once the product has expired', async () => {
			const expiryDate = inDays(-2);
			const product = await processOrderOf({
				type: 'EXPIRABLE', name: 'Milk', available: 6, leadTime: 90, expiryDate,
			});

			expect(product.available).toBe(0);
			expect(notifications.sendExpirationNotification).toHaveBeenCalledWith('Milk', expiryDate);
		});

		// Characterises existing behaviour: an in-date product that is merely out of
		// stock is reported as expired. Kept as-is, to be confirmed with the business.
		it('notifies the expiration of an in-date product that is out of stock', async () => {
			const expiryDate = inDays(26);
			const product = await processOrderOf({
				type: 'EXPIRABLE', name: 'Yoghurt', available: 0, leadTime: 15, expiryDate,
			});

			expect(product.available).toBe(0);
			expect(notifications.sendExpirationNotification).toHaveBeenCalledWith('Yoghurt', expiryDate);
		});
	});

	describe('an order as a whole', () => {
		it('returns the processed order id', async () => {
			const {orderId} = createOrder([{
				type: 'NORMAL', name: 'USB Cable', available: 30, leadTime: 15,
			}]);

			const response = await supertest(fastify.server)
				.post(`/orders/${orderId}/processOrder`)
				.expect(200)
				.expect('Content-Type', /application\/json/);

			expect(response.body).toEqual({orderId});
		});

		it('processes every product of the order independently', async () => {
			const stored = await processOrderOfAll(
				{
					type: 'NORMAL', name: 'USB Cable', available: 30, leadTime: 15,
				},
				{
					type: 'SEASONAL',
					name: 'Watermelon',
					available: 30,
					leadTime: 15,
					seasonStartDate: inDays(-2),
					seasonEndDate: inDays(58),
				},
				{
					type: 'EXPIRABLE', name: 'Milk', available: 6, leadTime: 90, expiryDate: inDays(-2),
				},
			);

			expect(stored.map(product => product.available)).toEqual([29, 29, 0]);
			expect(notifications.sendExpirationNotification).toHaveBeenCalledWith('Milk', expect.any(Date));
		});

		// Characterises existing behaviour: an unknown type is skipped without any signal.
		it('silently ignores a product of an unknown type', async () => {
			const product = await processOrderOf({
				// The database does not constrain the column, so this row is reachable.
				type: 'MYSTERY' as ProductType, name: 'Unobtainium', available: 30, leadTime: 15,
			});

			expect(product.available).toBe(30);
			expectNoNotification();
		});
	});

	function createOrder(ordered: ProductInsert[]): {orderId: number; productIds: number[]} {
		return database.transaction(tx => {
			const inserted = tx.insert(products).values(ordered).returning({id: products.id}).all();
			const order = tx.insert(orders).values([{}]).returning({id: orders.id}).get();
			tx.insert(ordersToProducts)
				.values(inserted.map(product => ({orderId: order.id, productId: product.id})))
				.run();
			return {orderId: order.id, productIds: inserted.map(product => product.id)};
		});
	}

	/** Orders a single product, then returns it as stored once the order has been processed. */
	async function processOrderOf(ordered: ProductInsert): Promise<Product> {
		const [stored] = await processOrderOfAll(ordered);
		if (!stored) {
			throw new Error(`Product "${ordered.name}" disappeared while processing the order`);
		}

		return stored;
	}

	/** Orders the given products, then returns them as stored, in the order they were passed. */
	async function processOrderOfAll(...ordered: ProductInsert[]): Promise<Product[]> {
		const {orderId, productIds} = createOrder(ordered);

		await supertest(fastify.server).post(`/orders/${orderId}/processOrder`).expect(200);

		const stored = await database.query.products.findMany({
			where: inArray(products.id, productIds),
		});
		return productIds.map(id => {
			const product = stored.find(candidate => candidate.id === id);
			if (!product) {
				throw new Error(`Product ${id} disappeared while processing the order`);
			}

			return product;
		});
	}

	function expectNoNotification(): void {
		expect(notifications.sendDelayNotification).not.toHaveBeenCalled();
		expect(notifications.sendOutOfStockNotification).not.toHaveBeenCalled();
		expect(notifications.sendExpirationNotification).not.toHaveBeenCalled();
	}
});
