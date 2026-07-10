import module from "node:module";
import { join } from "node:path";
import {
	getLatestTypesEntrypoint,
	getWorkerdCompatibilityDate,
} from "helpers/compatDate";
import { beforeEach, describe, test, vi } from "vitest";
import { createTestContext } from "../../__tests__/helpers";
import { mockSpinner, mockWorkersTypesDirectory } from "./mocks";

vi.mock("helpers/files");
vi.mock("fs");
vi.mock("@cloudflare/cli-shared-helpers/interactive");

describe("Compatibility Date Helpers", () => {
	let spinner: ReturnType<typeof mockSpinner>;

	beforeEach(() => {
		spinner = mockSpinner();
	});

	describe("getWorkerdCompatibilityDate()", () => {
		test("returns the local workerd compatibility date", async ({ expect }) => {
			const createRequireSpy = vi
				.spyOn(module, "createRequire")
				.mockImplementation(() => {
					const mockedRequire = ((pkg: string) => {
						if (pkg === "workerd") {
							return { compatibilityDate: "2026-07-09" };
						}
						return {};
					}) as NodeJS.Require;
					mockedRequire.resolve = ((pkg: string) =>
						pkg) as NodeJS.RequireResolve;
					return mockedRequire;
				});

			const date = getWorkerdCompatibilityDate("./my-app");

			expect(date).toBe("2026-07-09");
			expect(createRequireSpy).toHaveBeenCalledWith(
				join("./my-app", "package.json")
			);
			expect(spinner.start).toHaveBeenCalled();
			expect(spinner.stop).toHaveBeenCalledWith(expect.stringContaining(date));
		});

		test("falls back to today's date when workerd resolution fails", ({
			expect,
		}) => {
			vi.spyOn(module, "createRequire").mockImplementation(
				() => ({}) as NodeJS.Require
			);

			const date = getWorkerdCompatibilityDate("./my-app");

			expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect(spinner.stop).toHaveBeenCalledWith(expect.stringContaining(date));
		});

		test("clamps future workerd compatibility dates to today", ({ expect }) => {
			vi.useFakeTimers();
			vi.setSystemTime("2026-07-09T12:00:00.000Z");
			vi.spyOn(module, "createRequire").mockImplementation(() => {
				const mockedRequire = ((pkg: string) => {
					if (pkg === "workerd") {
						return { compatibilityDate: "2026-07-10" };
					}
					return {};
				}) as NodeJS.Require;
				mockedRequire.resolve = ((pkg: string) => pkg) as NodeJS.RequireResolve;
				return mockedRequire;
			});

			const date = getWorkerdCompatibilityDate("./my-app");

			expect(date).toBe("2026-07-09");
			expect(spinner.stop).toHaveBeenCalledWith(expect.stringContaining(date));
			vi.useRealTimers();
		});
	});

	describe("getLatestTypesEntrypoint", () => {
		const ctx = createTestContext();

		test("happy path", async ({ expect }) => {
			mockWorkersTypesDirectory();

			const entrypoint = getLatestTypesEntrypoint(ctx);
			expect(entrypoint).toBe("2023-07-01");
		});

		test("read error", async ({ expect }) => {
			mockWorkersTypesDirectory(() => {
				throw new Error("ENOENT: no such file or directory");
			});

			const entrypoint = getLatestTypesEntrypoint(ctx);
			expect(entrypoint).toBe(null);
		});

		test("empty directory", async ({ expect }) => {
			mockWorkersTypesDirectory(() => []);

			const entrypoint = getLatestTypesEntrypoint(ctx);
			expect(entrypoint).toBe(null);
		});

		test("no compat dates found", async ({ expect }) => {
			mockWorkersTypesDirectory(() => ["foo", "bar"]);

			const entrypoint = getLatestTypesEntrypoint(ctx);
			expect(entrypoint).toBe(null);
		});
	});
});
