import {type Product} from '@/db/schema.js';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const inDays = (days: number) => new Date(Date.now() + (days * DAY_IN_MS));

/** A NORMAL, in-stock product; override only what the test is about. */
export function aProduct(overrides: Partial<Product> = {}): Product {
	return {
		id: 1,
		name: 'USB Cable',
		type: 'NORMAL',
		available: 30,
		leadTime: 15,
		expiryDate: null,
		seasonStartDate: null,
		seasonEndDate: null,
		...overrides,
	};
}
