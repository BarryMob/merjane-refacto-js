import {
	describe, it, expect, beforeEach,
} from 'vitest';
import {mockDeep, type DeepMockProxy} from 'vitest-mock-extended';
import {NormalProductHandler} from './normal-product.handler.js';
import {type INotificationService} from '@/services/notifications.port.js';
import {type ProductRepository} from '@/repositories/product.repository.js';
import {aProduct} from '@/utils/test-utils/product.factory.js';

describe('NormalProductHandler', () => {
	let notificationService: DeepMockProxy<INotificationService>;
	let productRepository: DeepMockProxy<ProductRepository>;
	let handler: NormalProductHandler;

	beforeEach(() => {
		notificationService = mockDeep<INotificationService>();
		productRepository = mockDeep<ProductRepository>();
		handler = new NormalProductHandler({notificationService, productRepository});
	});

	it('takes one unit out of the stock when the product is available', async () => {
		const product = aProduct({available: 30});

		await handler.handle(product);

		expect(productRepository.decrementStock).toHaveBeenCalledWith(product);
		expect(notificationService.sendDelayNotification).not.toHaveBeenCalled();
	});

	it('announces the restocking delay when the product is out of stock', async () => {
		const product = aProduct({name: 'USB Dongle', available: 0, leadTime: 10});

		await handler.handle(product);

		expect(notificationService.sendDelayNotification).toHaveBeenCalledWith(10, 'USB Dongle');
		expect(productRepository.decrementStock).not.toHaveBeenCalled();
	});

	it('announces nothing when the product is out of stock without a lead time', async () => {
		const product = aProduct({available: 0, leadTime: 0});

		await handler.handle(product);

		expect(notificationService.sendDelayNotification).not.toHaveBeenCalled();
		expect(productRepository.decrementStock).not.toHaveBeenCalled();
	});
});
