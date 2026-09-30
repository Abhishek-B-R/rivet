import { describe, expect, test } from "vitest";
import { ActorHandleRaw } from "@/client/actor-handle";
import type { UniversalWebSocket } from "@/common/websocket-interface";
import type { EngineControlClient } from "@/engine-client/driver";

function directHandle(driver: EngineControlClient) {
	return new ActorHandleRaw({}, driver, undefined, undefined, "json", {
		getForId: { name: "example", actorId: "actor-1" },
	});
}

describe("raw actor paths", () => {
	test("fetch keeps dot segments inside the /request prefix", async () => {
		const paths: string[] = [];
		const driver = {
			async sendRequest(_target: unknown, request: Request) {
				const url = new URL(request.url);
				paths.push(`${url.pathname}${url.search}`);
				return new Response("ok");
			},
		} as unknown as EngineControlClient;
		const handle = directHandle(driver);

		await handle.fetch("../action/increment");
		await handle.fetch("/files/%2e%2e/%2e%2e/queue/jobs?x=1");
		await handle.fetch("/files/../report");

		expect(paths).toEqual([
			"/request/action/increment",
			"/request/queue/jobs?x=1",
			"/request/report",
		]);
	});

	test("webSocket keeps dot segments inside the /websocket prefix", async () => {
		const paths: string[] = [];
		const driver = {
			async openWebSocket(path: string) {
				paths.push(path);
				return {} as UniversalWebSocket;
			},
		} as unknown as EngineControlClient;
		const handle = directHandle(driver);

		await handle.webSocket("../../other-actor/websocket/chat?room=1");
		await handle.webSocket("/chat/../lobby");

		expect(paths).toEqual([
			"/websocket/other-actor/websocket/chat?room=1",
			"/websocket/lobby",
		]);
	});
});
