import { afterEach, describe, expect, test, vi } from "vitest";
import { interval, joinSignals } from "./utils";

describe("joinSignals", () => {
	test("returns a non-aborted signal when no inputs are provided", () => {
		const signal = joinSignals();
		expect(signal.aborted).toBe(false);
	});

	test("returns the same signal when only one input is provided", () => {
		const controller = new AbortController();
		const signal = joinSignals(controller.signal);
		expect(signal).toBe(controller.signal);
	});

	test("aborts immediately when any input signal is already aborted", () => {
		const controllerA = new AbortController();
		const controllerB = new AbortController();
		controllerA.abort("already-aborted");

		const signal = joinSignals(controllerA.signal, controllerB.signal);
		expect(signal.aborted).toBe(true);
	});

	test("aborts when one of the joined signals aborts", () => {
		const controllerA = new AbortController();
		const controllerB = new AbortController();
		const signal = joinSignals(controllerA.signal, controllerB.signal);

		expect(signal.aborted).toBe(false);
		controllerB.abort("stopped");
		expect(signal.aborted).toBe(true);
	});
});

describe("interval", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	test("ticks at a fixed rate when the loop body takes time", async () => {
		vi.useFakeTimers();
		const start = performance.now();
		const tick = interval(100);
		const ticks: number[] = [];

		for (let i = 0; i < 3; i++) {
			const next = tick();
			await vi.advanceTimersToNextTimerAsync();
			await next;
			ticks.push(performance.now() - start);
			// Simulate 30ms of work in the loop body.
			vi.advanceTimersByTime(30);
		}

		expect(ticks).toEqual([100, 200, 300]);
	});

	test("skips missed ticks instead of bursting after a long pause", async () => {
		vi.useFakeTimers();
		const start = performance.now();
		const tick = interval(100);

		const first = tick();
		await vi.advanceTimersToNextTimerAsync();
		await first;
		// The loop body overruns by more than two periods.
		vi.advanceTimersByTime(250);

		const late = tick();
		await vi.advanceTimersToNextTimerAsync();
		await late;
		expect(performance.now() - start).toBe(350);

		const next = tick();
		await vi.advanceTimersToNextTimerAsync();
		await next;
		expect(performance.now() - start).toBe(450);
	});
});
