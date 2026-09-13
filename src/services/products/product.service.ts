import {type Cradle} from '@fastify/awilix';
import {type FastifyBaseLogger} from 'fastify';
import {type ProductHandler} from './handlers/product.handler.js';
import {type Product, type ProductType} from '@/db/schema.js';

type ProductServiceDependencies = Pick<Cradle,
'logger' | 'normalProductHandler' | 'seasonalProductHandler' | 'expirableProductHandler'>;

/** Routes a product to the handler that knows its availability rules. */
export class ProductService {
	private readonly logger: FastifyBaseLogger;
	private readonly handlers: Record<ProductType, ProductHandler>;

	public constructor({
		logger, normalProductHandler, seasonalProductHandler, expirableProductHandler,
	}: ProductServiceDependencies) {
		this.logger = logger;
		this.handlers = {
			NORMAL: normalProductHandler,
			SEASONAL: seasonalProductHandler,
			EXPIRABLE: expirableProductHandler,
		};
	}

	public async processOrderedProduct(product: Product): Promise<void> {
		// The column is not constrained in the database, so an unknown type can reach us.
		const handler: ProductHandler | undefined = this.handlers[product.type];

		if (!handler) {
			this.logger.warn({productId: product.id, type: product.type}, 'Unknown product type, product left untouched');
			return;
		}

		await handler.handle(product);
	}
}
