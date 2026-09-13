import {type Cradle} from '@fastify/awilix';
import {type ProductHandler} from './product.handler.js';
import {type INotificationService} from '@/services/notifications.port.js';
import {type ProductRepository} from '@/repositories/product.repository.js';
import {type Product} from '@/db/schema.js';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/**
 * "Les produits SEASONAL ne sont disponibles qu'à certaines périodes de l'année.
 * Lorsqu'ils sont en rupture de stock, un délai est annoncé aux clients, mais si
 * ce délai dépasse la saison de disponibilité, le produit est considéré comme non
 * disponible. Quand le produit est considéré comme non disponible, les clients
 * sont notifiés de cette indisponibilité."
 */
export class SeasonalProductHandler implements ProductHandler {
	private readonly notificationService: INotificationService;
	private readonly productRepository: ProductRepository;

	public constructor({notificationService, productRepository}: Pick<Cradle, 'notificationService' | 'productRepository'>) {
		this.notificationService = notificationService;
		this.productRepository = productRepository;
	}

	public async handle(product: Product): Promise<void> {
		const now = new Date();

		if (this.isInSeason(product, now) && product.available > 0) {
			await this.productRepository.decrementStock(product);
			return;
		}

		// Restocking would arrive after the season is over: the product is done for this year.
		if (this.restockingMissesTheSeason(product, now)) {
			this.notificationService.sendOutOfStockNotification(product.name);
			await this.productRepository.markAsUnavailable(product);
			return;
		}

		// The season has not opened yet, so the product is not available — but the
		// stock it already holds stays untouched, waiting for the season to start.
		if (this.seasonHasNotStarted(product, now)) {
			this.notificationService.sendOutOfStockNotification(product.name);
			return;
		}

		// In season but out of stock, and restocking arrives in time.
		this.notificationService.sendDelayNotification(product.leadTime, product.name);
	}

	private isInSeason(product: Product, now: Date): boolean {
		return product.seasonStartDate !== null
			&& product.seasonEndDate !== null
			&& now > product.seasonStartDate
			&& now < product.seasonEndDate;
	}

	private restockingMissesTheSeason(product: Product, now: Date): boolean {
		// Without a season end there is no season to restock into.
		if (product.seasonEndDate === null) {
			return true;
		}

		const restockedOn = new Date(now.getTime() + (product.leadTime * DAY_IN_MS));
		return restockedOn > product.seasonEndDate;
	}

	private seasonHasNotStarted(product: Product, now: Date): boolean {
		return product.seasonStartDate !== null && product.seasonStartDate > now;
	}
}
