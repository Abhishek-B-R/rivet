import { describe, expect, test } from "vitest";
import { ActorConnRaw, CONNECT_SYMBOL } from "@/client/actor-conn";
import { ACTOR_CONNS_SYMBOL, type ClientRaw } from "@/client/client";
import { ActorConnDisposed, ActorError } from "@/client/errors";
import type { UniversalWebSocket } from "@/common/websocket-interface";
import type { EngineControlClient } from "@/engine-client/driver";

class FakeWebSocket extends EventTarget {
	readyState = 1;
	onListenersAttached?: () => void;

	override addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject | null,
	) {
		super.addEventListener(type, listener);
		// The connection registers its error listener last, so the socket is
		// fully wired once it arrives.
		if (type === "error") {
			queueMicrotask(() => this.onListenersAttached?.());
		}
	}

	send() {}

	close(code = 1000, reason = "Disposed") {
		this.readyState = 3;
		this.dispatchEvent(
			Object.assign(new Event("close"), {
				code,
				reason,
				wasClean: true,
			}),
		);
	}
}

function createConn(ws: FakeWebSocket) {
	const driver = {
		async openWebSocket() {
			return ws as unknown as UniversalWebSocket;
		},
	} as unknown as EngineControlClient;
	const client = {
		[ACTOR_CONNS_SYMBOL]: new Set(),
	} as unknown as ClientRaw;
	return new ActorConnRaw(client, driver, undefined, undefined, "json", {
		getForId: { name: "counter", actorId: "actor-1" },
	});
}

describe("ActorConnRaw ready", () => {
	test("rejects when the connection is disposed before it opens", async () => {
		const ws = new FakeWebSocket();
		const conn = createConn(ws);
		const opened = new Promise<void>((resolve) => {
			ws.onListenersAttached = resolve;
		});
		conn[CONNECT_SYMBOL]();
		await opened;

		const ready = conn.ready;
		await conn.dispose();

		await expect(ready).rejects.toBeInstanceOf(ActorConnDisposed);
	});

	test("rejects when the connection fails without retrying", async () => {
		const ws = new FakeWebSocket();
		const conn = createConn(ws);
		ws.onListenersAttached = () => ws.close(1011, "user.forbidden");
		conn[CONNECT_SYMBOL]();

		const error = await conn.ready.then(
			() => undefined,
			(err: unknown) => err,
		);
		expect(error).toBeInstanceOf(ActorError);
		expect(error).toMatchObject({ group: "user", code: "forbidden" });
		expect(conn.connStatus).toBe("idle");

		await conn.dispose();
	});
});
