import {type Cradle, diContainer} from '@fastify/awilix';
import {asClass, asValue} from 'awilix';
import {type FastifyBaseLogger, type FastifyInstance} from 'fastify';
import {type INotificationService} from '@/services/notifications.port.js';
import {NotificationService} from '@/services/impl/notification.service.js';
import {type Database} from '@/db/type.js';
import {OrderRepository} from '@/repositories/order.repository.js';
import {ProductRepository} from '@/repositories/product.repository.js';
import {OrderService} from '@/services/orders/order.service.js';
import {ProductService} from '@/services/products/product.service.js';
import {NormalProductHandler} from '@/services/products/handlers/normal-product.handler.js';
import {SeasonalProductHandler} from '@/services/products/handlers/seasonal-product.handler.js';
import {ExpirableProductHandler} from '@/services/products/handlers/expirable-product.handler.js';

declare module '@fastify/awilix' {

	interface Cradle { // eslint-disable-line @typescript-eslint/consistent-type-definitions
		logger: FastifyBaseLogger;
		db: Database;
		notificationService: INotificationService;
		orderRepository: OrderRepository;
		productRepository: ProductRepository;
		orderService: OrderService;
		productService: ProductService;
		normalProductHandler: NormalProductHandler;
		seasonalProductHandler: SeasonalProductHandler;
		expirableProductHandler: ExpirableProductHandler;
	}
}

export async function configureDiContext(
	server: FastifyInstance,
): Promise<void> {
	diContainer.register({
		logger: asValue(server.log),
		db: asValue(server.database),

		// Ports
		notificationService: asClass(NotificationService),

		// Persistence
		orderRepository: asClass(OrderRepository),
		productRepository: asClass(ProductRepository),

		// Domain
		normalProductHandler: asClass(NormalProductHandler),
		seasonalProductHandler: asClass(SeasonalProductHandler),
		expirableProductHandler: asClass(ExpirableProductHandler),
		productService: asClass(ProductService),

		// Application
		orderService: asClass(OrderService),
	});
}

export function resolve<Service extends keyof Cradle>(
	service: Service,
): Cradle[Service] {
	return diContainer.resolve(service);
}
