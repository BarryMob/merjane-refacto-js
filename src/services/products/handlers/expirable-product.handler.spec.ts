import {
	describe, it, expect, beforeEach,
} from 'vitest';
import {mockDeep, type DeepMockProxy} from 'vitest-mock-extended';
import {ExpirableProductHandler} from './expirable-product.handler.js';
import {type INotificationService} from '@/services/notifications.port.js';
import {type ProductRepository} from '@/repositories/product.repository.js';
import {aProduct, inDays} from '@/utils/test-utils/product.factory.js';

describe('ExpirableProductHandler', () => {
	let notificationService: DeepMockProxy<INotificationService>;
	let productRepository: DeepMockProxy<ProductRepository>;
	let handler: ExpirableProductHandler;

	beforeEach(() => {
		notificationService = mockDeep<INotificationService>();
		productRepository = mockDeep<ProductRepository>();
		handler = new ExpirableProductHandler({notificationService, productRepository});
	});

	it('takes one unit out of the stock while the product has not expired', async () => {
		const product = aProduct({
			type: 'EXPIRABLE', name: 'Butter', available: 30, expiryDate: inDays(26),
		});

		await handler.handle(product);

		expect(productRepository.decrementStock).toHaveBeenCalledWith(product);
		expect(notificationService.sendExpirationNotification).not.toHaveBeenCalled();
	});

	it('empties the stock and notifies the expiration once the product has expired', async () => {
		const expiryDate = inDays(-2);
		const product = aProduct({
			type: 'EXPIRABLE', name: 'Milk', available: 6, expiryDate,
		});

		await handler.handle(product);

		expect(notificationService.sendExpirationNotification).toHaveBeenCalledWith('Milk', expiryDate);
		expect(productRepository.markAsUnavailable).toHaveBeenCalledWith(product);
	});

	// Pre-existing behaviour, kept on purpose. See "Open questions" in the README.
	it('notifies the expiration of an in-date product that is out of stock', async () => {
		const expiryDate = inDays(26);
		const product = aProduct({
			type: 'EXPIRABLE', name: 'Yoghurt', available: 0, expiryDate,
		});

		await handler.handle(product);

		expect(notificationService.sendExpirationNotification).toHaveBeenCalledWith('Yoghurt', expiryDate);
		expect(productRepository.markAsUnavailable).toHaveBeenCalledWith(product);
	});
});
