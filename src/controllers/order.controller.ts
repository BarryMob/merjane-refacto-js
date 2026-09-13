import fastifyPlugin from 'fastify-plugin';
import {serializerCompiler, validatorCompiler, type ZodTypeProvider} from 'fastify-type-provider-zod';
import {z} from 'zod';
import {OrderNotFoundError} from '@/services/orders/order-not-found.error.js';

export const orderController = fastifyPlugin(async server => {
	server.setValidatorCompiler(validatorCompiler);
	server.setSerializerCompiler(serializerCompiler);

	server.withTypeProvider<ZodTypeProvider>().post('/orders/:orderId/processOrder', {
		schema: {
			params: z.object({
				orderId: z.coerce.number().int().positive(),
			}),
		},
	}, async (request, reply) => {
		const orderService = request.diScope.resolve('orderService');

		try {
			const orderId = await orderService.processOrder(request.params.orderId);
			await reply.send({orderId});
		} catch (error) {
			if (error instanceof OrderNotFoundError) {
				await reply.status(404).send({message: error.message});
				return;
			}

			throw error;
		}
	});
});
