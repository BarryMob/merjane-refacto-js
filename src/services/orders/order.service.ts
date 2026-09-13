import {type Cradle} from '@fastify/awilix';
import {OrderNotFoundError} from './order-not-found.error.js';
import {type OrderRepository} from '@/repositories/order.repository.js';
import {type ProductService} from '@/services/products/product.service.js';

export class OrderService {
	private readonly orderRepository: OrderRepository;
	private readonly productService: ProductService;

	public constructor({orderRepository, productService}: Pick<Cradle, 'orderRepository' | 'productService'>) {
		this.orderRepository = orderRepository;
		this.productService = productService;
	}

	/**
	 * Applies the availability rules of every product of the order.
	 *
	 * @throws {OrderNotFoundError} when no order carries this id.
	 */
	public async processOrder(orderId: number): Promise<number> {
		const order = await this.orderRepository.findByIdWithProducts(orderId);

		if (!order) {
			throw new OrderNotFoundError(orderId);
		}

		for (const {product} of order.products) {
			// Products are handled one at a time so that customer notifications keep
			// the order of the basket.
			await this.productService.processOrderedProduct(product); // eslint-disable-line no-await-in-loop
		}

		return order.id;
	}
}
