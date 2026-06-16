export default class RequestHandler {
	static mode = import.meta.env.MODE
	static port = import.meta.env.VITE_BACKEND_PORT ?? "5000"

	static baseURL =
		(RequestHandler.mode === "development"
			? (import.meta.env.VITE_DEVELOPMENT_URL ?? "http://localhost:") + RequestHandler.port
			: RequestHandler.mode === "production"
				? (import.meta.env.VITE_PRODUCTION_URL ?? "http://localhost:") + RequestHandler.port
				: RequestHandler.mode === "deployed"
					? import.meta.env.VITE_DEPLOYED_URL ?? ""
					: "http://localhost:5000").trim()

	static apiLink = "api"

	static init() {
		const token = import.meta.env.VITE_API_ACCESS;
		if (token && typeof window !== "undefined") {
			localStorage.setItem("authAccess", token);
		}
	}

	private static buildURL(
		link: string,
		params?: Record<string, any>
	): string {
		const base = `${RequestHandler.baseURL}/${RequestHandler.apiLink}/${link}`;
		if (!params || Object.keys(params).length === 0) return base;

		const query = new URLSearchParams(
			Object.entries(params).reduce(
				(acc, [k, v]) => {
					if (v !== undefined && v !== null) acc[k] = String(v);
					return acc;
				},
				{} as Record<string, string>
			)
		).toString();

		return query ? `${base}?${query}` : base;
	}

	static async fetchData(
		method: string,
		link: string,
		requestData: Record<string, any> | FormData = {},
		headers: Record<string, string> = {},
		callback: ((error: string | null, data?: any) => void) | null = null
	) {
		const upperMethod = method.toUpperCase();
		const isBodyless = ["GET", "HEAD", "DELETE"].includes(upperMethod);
		const isFormData = requestData instanceof FormData;

		const url = isBodyless && !isFormData
			? RequestHandler.buildURL(link, requestData as Record<string, any>)
			: `${RequestHandler.baseURL}/${RequestHandler.apiLink}/${link}`;

		const isClient = typeof window !== "undefined";
		const authToken = isClient ? localStorage.getItem("authToken") : null;
		const authAccess = isClient ? localStorage.getItem("authAccess") : null;

		if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
		if (authAccess) headers["X-Auth-Token"] = `Bearer ${authAccess}`;

		const options: RequestInit = { method: upperMethod };

		if (isFormData) {
			options.headers = { ...headers };
			if (!isBodyless) options.body = requestData;
		} else {
			options.headers = { "Content-Type": "application/json", ...headers };
			if (!isBodyless) options.body = JSON.stringify(requestData);
		}

		try {
			const response = await fetch(url, options);
			const responseData = await response.json();

			if (!response.ok) {
				throw new Error(
					responseData.message || `HTTP error! Status: ${response.status}`
				);
			}

			if (callback) callback(null, responseData);
			return responseData;
		} catch (error: any) {
			console.error("Fetch error:", error);
			if (callback) {
				callback(
					error.message || "Something went wrong. Please try again later.",
					undefined
				);
			}
			return {
				success: false,
				message: error.message || "An error occurred",
				baseURL: RequestHandler.baseURL,
				url,
			};
		}
	}

	static async streamData(
		method: string,
		link: string,
		requestData: FormData | Record<string, any> = {},
		onChunk: (msg: Record<string, any>) => void = () => { }
	): Promise<void> {
		const url = `${RequestHandler.baseURL}/${RequestHandler.apiLink}/${link}`;
		const isClient = typeof window !== "undefined";
		const headers: Record<string, string> = {};

		const authToken = isClient ? localStorage.getItem("authToken") : null;
		const authAccess = isClient ? localStorage.getItem("authAccess") : null;
		if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
		if (authAccess) headers["X-Auth-Token"] = `Bearer ${authAccess}`;

		const isFormData = requestData instanceof FormData;
		const options: RequestInit = {
			method: method.toUpperCase(),
			headers,
			body: isFormData ? requestData : JSON.stringify(requestData),
		};
		if (!isFormData) headers["Content-Type"] = "application/json";

		const response = await fetch(url, options);
		if (!response.ok || !response.body) {
			throw new Error(`HTTP error! Status: ${response.status}`);
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let buffer = "";

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split("\n");
			buffer = lines.pop() ?? "";

			for (const line of lines) {
				if (!line.startsWith("data: ")) continue;
				try {
					onChunk(JSON.parse(line.slice(6)));
				} catch {
					console.error("Failed to parse SSE chunk:", line);
				}
			}
		}
	}
}