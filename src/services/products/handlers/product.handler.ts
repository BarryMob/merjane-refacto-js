import {type Product} from '@/db/schema.js';

/**
 * Applies the availability rules of one product type to a product being ordered.
 * One implementation per value of {@link ProductType}.
 */
export type ProductHandler = {
	handle(product: Product): Promise<void>;
};
