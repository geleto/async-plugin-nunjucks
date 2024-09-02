//@ todo: make this a folder
export function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		// If it's an instance of Error, return the message
		return error.message;
	} else if (typeof error === 'string') {
		// If the caught error is a string, return it directly
		return error;
	} else if (typeof error === 'object' && error !== null) {
		// If it's an object, attempt to stringify it
		// You might want to handle this differently depending on your needs
		return JSON.stringify(error);
	} else {
		// For all other cases, return a generic message
		return 'An unknown error occurred';
	}
}

// converts and object with getters and setters to a JSON object, ignnores properties starting with _
export function objectJsonify(obj: Record<string, any>) {
	if (typeof obj !== 'object' || obj === null) return JSON.stringify(obj);

	const jsonObj: Record<string, any> = Array.isArray(obj) ? [] : {};

	function processProperty(key: string, value: any) {
		if (typeof value === 'function') return;
		if (typeof value === 'object' && value !== null) {
			jsonObj[key] = objectJsonify(value as Record<string, any>);
		} else {
			jsonObj[key] = value;
		}
	}

	// Process own properties
	Object.entries(obj).forEach(([key, value]) => {
		processProperty(key, value);
	});

	// Process prototype properties
	const proto = Object.getPrototypeOf(obj);
	if (proto && proto !== Object.prototype) {
		Object.entries(Object.getOwnPropertyDescriptors(proto))
			.filter(([_key, descriptor]) => typeof descriptor.get === 'function')
			.forEach(([key]) => {
				if (key[0] !== '_') {
					try {
						const val = obj[key];
						processProperty(key, val);
					} catch (error) {
						console.error(`Error calling getter ${key}`, error);
					}
				}
			});
	}

	return jsonObj;
}

// converts and object with getters and setters to a formatted JSON text, ignnores properties starting with _
export function objectStringify(obj: Record<string, any>): string {
	return JSON.stringify(objectJsonify(obj), null, 2);
}

// waits for a quiet period before running the latest callback, then shares the result with all other callers
export class AsyncDebounce<T> {
	private readonly timeout: number;
	private timer: NodeJS.Timeout | null = null;
	private latestCallback: (() => Promise<T>) | null = null;
	private pendingPromise: Promise<T> | null = null;

	constructor(timeout: number) {
		this.timeout = timeout;
	}

	async start(callback: () => Promise<T>, initialCallback?: () => void): Promise<T> {
		this.latestCallback = callback;

		if (this.pendingPromise) {
			return await this.pendingPromise;
		}

		if (initialCallback) {
			initialCallback();
		}

		this.pendingPromise = new Promise<T>((resolve, reject) => {
			const executeCallback = async () => {
				if (this.latestCallback) {
					try {
						const result = await this.latestCallback();
						resolve(result);
					} catch (error) {
						reject(error);
					} finally {
						this.timer = null;
						this.latestCallback = null;
						this.pendingPromise = null;
					}
				}
			};

			if (this.timer === null) {
				this.timer = setTimeout(() => { void executeCallback() }, this.timeout);
			}
		});

		return await this.pendingPromise;
	}
}
