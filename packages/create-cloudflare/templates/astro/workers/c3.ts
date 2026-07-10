import { logRaw } from "@cloudflare/cli-shared-helpers";
import { brandColor, dim } from "@cloudflare/cli-shared-helpers/colors";
import { runCommand } from "@cloudflare/cli-shared-helpers/command";
import { runFrameworkGenerator } from "frameworks/index";
import { usesTypescript } from "helpers/files";
import { detectPackageManager } from "helpers/packageManagers";
import { updateWranglerConfig } from "../../../src/wrangler/config";
import type { TemplateConfig } from "../../../src/templates";
import type { C3Context, PackageJson } from "types";

const { npx } = detectPackageManager();

const generate = async (ctx: C3Context) => {
	// `--add cloudflare` could be used here because it invokes `astro` which is not installed (`--no-install`)
	// The adapter is added in the `configure` step instead
	await runFrameworkGenerator(ctx, [
		ctx.project.name,
		// c3 will later install the dependencies
		"--no-install",
		// c3 will later ask users if they want to use git
		"--no-git",
	]);

	logRaw(""); // newline
};

const configure = async (ctx: C3Context) => {
	await runCommand([npx, "astro", "add", "cloudflare", "-y"], {
		silent: true,
		startText: "Installing adapter",
		doneText: `${brandColor("installed")} ${dim(
			`via \`${npx} astro add cloudflare\``
		)}`,
	});

	// `astro add cloudflare` creates Wrangler config after C3's initial config pass.
	// Re-apply the locally supported compat date so generated projects work with the
	// bundled workerd used in local dev and C3 e2e.
	await updateWranglerConfig(ctx, { forceCompatibilityDate: true });
};

const config: TemplateConfig = {
	configVersion: 1,
	id: "astro",
	frameworkCli: "create-astro",
	platform: "workers",
	displayName: "Astro",
	copyFiles: {
		async selectVariant(ctx) {
			// Note: this `selectVariant` function should not be needed
			//       this is just a quick workaround until
			//       https://github.com/cloudflare/workers-sdk/issues/7495
			//       is resolved
			return usesTypescript(ctx) ? "ts" : "js";
		},
		variants: {
			js: {
				path: "./templates/js",
			},
			ts: {
				path: "./templates/ts",
			},
		},
	},
	devScript: "dev",
	deployScript: "deploy",
	previewScript: "preview",
	path: "templates/astro/workers",
	generate,
	configure,
	transformPackageJson: async (pkgJson: PackageJson, ctx: C3Context) => ({
		scripts: {
			deploy: `astro build && wrangler deploy`,
			preview: `astro build && astro preview`,
			...(usesTypescript(ctx) && { "cf-typegen": `wrangler types` }),
		},
	}),
};
export default config;
