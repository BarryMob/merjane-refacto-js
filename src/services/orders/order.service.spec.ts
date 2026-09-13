import {
	describe, it, expect, beforeEach,
} from 'vitest';
import {mockDeep, type DeepMockProxy} from 'vitest-mock-extended';
import {OrderService} from './order.service.js';
import {OrderNotFoundError} from './order-not-found.error.js';
import {type OrderRepository} from '@/repositories/order.repository.js';
import {type ProductService} from '@/services/products/product.service.js';
import {aProduct} from '@/utils/test-utils/product.factory.js';

describe('OrderService', () => {
	let orderRepository: DeepMockProxy<OrderRepository>;
	let productService: DeepMockProxy<ProductService>;
	let orderService: OrderService;

	beforeEach(() => {
		orderRepository = mockDeep<OrderRepository>();
		productService = mockDeep<ProductService>();
		orderService = new OrderService({orderRepository, productService});
	});

	it('hands every product of the order to the product service', async () => {
		const usbCable = aProduct({id: 1, name: 'USB Cable'});
		const milk = aProduct({id: 2, name: 'Milk'});
		orderRepository.findByIdWithProducts.mockResolvedValue({
			id: 42,
			products: [{product: usbCable}, {product: milk}],
		});

		const orderId = await orderService.processOrder(42);

		expect(orderId).toBe(42);
		expect(productService.processOrderedProduct).toHaveBeenCalledTimes(2);
		expect(productService.processOrderedProduct).toHaveBeenNthCalledWith(1, usbCable);
		expect(productService.processOrderedProduct).toHaveBeenNthCalledWith(2, milk);
	});

	it('accepts an order without any product', async () => {
		orderRepository.findByIdWithProducts.mockResolvedValue({id: 42, products: []});

		await expect(orderService.processOrder(42)).resolves.toBe(42);
		expect(productService.processOrderedProduct).not.toHaveBeenCalled();
	});

	it('reports an unknown order instead of failing silently', async () => {
		orderRepository.findByIdWithProducts.mockResolvedValue(undefined);

		await expect(orderService.processOrder(404)).rejects.toThrow(OrderNotFoundError);
	});
});
