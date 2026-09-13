export class OrderNotFoundError extends Error {
	public constructor(public readonly orderId: number) {
		super(`Order ${orderId} not found`);
		this.name = 'OrderNotFoundError';
	}
}
