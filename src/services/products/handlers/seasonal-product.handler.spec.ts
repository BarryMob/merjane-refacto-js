import {
	describe, it, expect, beforeEach,
} from 'vitest';
import {mockDeep, type DeepMockProxy} from 'vitest-mock-extended';
import {SeasonalProductHandler} from './seasonal-product.handler.js';
import {type INotificationService} from '@/services/notifications.port.js';
import {type ProductRepository} from '@/repositories/product.repository.js';
import {aProduct, inDays} from '@/utils/test-utils/product.factory.js';

describe('SeasonalProductHandler', () => {
	let notificationService: DeepMockProxy<INotificationService>;
	let productRepository: DeepMockProxy<ProductRepository>;
	let handler: SeasonalProductHandler;

	const inSeason = {seasonStartDate: inDays(-2), seasonEndDate: inDays(58)};

	beforeEach(() => {
		notificationService = mockDeep<INotificationService>();
		productRepository = mockDeep<ProductRepository>();
		handler = new SeasonalProductHandler({notificationService, productRepository});
	});

	it('takes one unit out of the stock when in season and available', async () => {
		const product = aProduct({type: 'SEASONAL', available: 30, ...inSeason});

		await handler.handle(product);

		expect(productRepository.decrementStock).toHaveBeenCalledWith(product);
		expect(notificationService.sendOutOfStockNotification).not.toHaveBeenCalled();
	});

	it('announces the restocking delay when out of stock and restocking lands within the season', async () => {
		const product = aProduct({
			type: 'SEASONAL', name: 'Strawberry', available: 0, leadTime: 15, ...inSeason,
		});

		await handler.handle(product);

		expect(notificationService.sendDelayNotification).toHaveBeenCalledWith(15, 'Strawberry');
		expect(productRepository.markAsUnavailable).not.toHaveBeenCalled();
	});

	it('declares the product unavailable when restocking would land after the season ends', async () => {
		const product = aProduct({
			type: 'SEASONAL', name: 'Cherry', available: 0, leadTime: 90, ...inSeason,
		});

		await handler.handle(product);

		expect(notificationService.sendOutOfStockNotification).toHaveBeenCalledWith('Cherry');
		expect(productRepository.markAsUnavailable).toHaveBeenCalledWith(product);
	});

	it('declares the product unavailable before the season starts, without touching the stock', async () => {
		const product = aProduct({
			type: 'SEASONAL',
			name: 'Grapes',
			available: 30,
			leadTime: 15,
			seasonStartDate: inDays(180),
			seasonEndDate: inDays(240),
		});

		await handler.handle(product);

		expect(notificationService.sendOutOfStockNotification).toHaveBeenCalledWith('Grapes');
		expect(productRepository.markAsUnavailable).not.toHaveBeenCalled();
		expect(productRepository.decrementStock).not.toHaveBeenCalled();
	});

	it('declares the product unavailable and empties the stock once the season is over', async () => {
		const product = aProduct({
			type: 'SEASONAL',
			name: 'Pumpkin',
			available: 30,
			leadTime: 15,
			seasonStartDate: inDays(-100),
			seasonEndDate: inDays(-10),
		});

		await handler.handle(product);

		expect(notificationService.sendOutOfStockNotification).toHaveBeenCalledWith('Pumpkin');
		expect(productRepository.markAsUnavailable).toHaveBeenCalledWith(product);
	});
});
