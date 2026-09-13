import {type Cradle} from '@fastify/awilix';
import {type ProductHandler} from './product.handler.js';
import {type INotificationService} from '@/services/notifications.port.js';
import {type ProductRepository} from '@/repositories/product.repository.js';
import {type Product} from '@/db/schema.js';

/**
 * "Les produits EXPIRABLE ont une date d'expiration. Ils peuvent être vendus
 * normalement tant qu'ils n'ont pas expiré, mais ne sont plus disponibles une
 * fois la date d'expiration passée."
 */
export class ExpirableProductHandler implements ProductHandler {
	private readonly notificationService: INotificationService;
	private readonly productRepository: ProductRepository;

	public constructor({notificationService, productRepository}: Pick<Cradle, 'notificationService' | 'productRepository'>) {
		this.notificationService = notificationService;
		this.productRepository = productRepository;
	}

	public async handle(product: Product): Promise<void> {
		if (product.available > 0 && !this.hasExpired(product, new Date())) {
			await this.productRepository.decrementStock(product);
			return;
		}

		// Pre-existing behaviour: a product that is out of stock but still in date is
		// reported as expired too. To be confirmed with the business.
		this.notificationService.sendExpirationNotification(product.name, product.expiryDate!);
		await this.productRepository.markAsUnavailable(product);
	}

	private hasExpired(product: Product, now: Date): boolean {
		// A product that carries no expiry date cannot be proven fresh.
		return product.expiryDate === null || product.expiryDate <= now;
	}
}
