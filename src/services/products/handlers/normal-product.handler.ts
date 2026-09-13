import {type Cradle} from '@fastify/awilix';
import {type ProductHandler} from './product.handler.js';
import {type INotificationService} from '@/services/notifications.port.js';
import {type ProductRepository} from '@/repositories/product.repository.js';
import {type Product} from '@/db/schema.js';

/**
 * "Les produits NORMAL ne présentent aucune particularité. Lorsqu'ils sont en
 * rupture de stock, un délai est simplement annoncé aux clients."
 */
export class NormalProductHandler implements ProductHandler {
	private readonly notificationService: INotificationService;
	private readonly productRepository: ProductRepository;

	public constructor({notificationService, productRepository}: Pick<Cradle, 'notificationService' | 'productRepository'>) {
		this.notificationService = notificationService;
		this.productRepository = productRepository;
	}

	public async handle(product: Product): Promise<void> {
		if (product.available > 0) {
			await this.productRepository.decrementStock(product);
			return;
		}

		// A product without a lead time has no delay to announce.
		if (product.leadTime > 0) {
			this.notificationService.sendDelayNotification(product.leadTime, product.name);
		}
	}
}
