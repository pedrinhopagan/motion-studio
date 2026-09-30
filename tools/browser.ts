import { chromium, type Browser } from "playwright-core";
import { readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const MOTION_ROOT = join(import.meta.dir, "..");

export async function launchRenderBrowser() {
	const base = join(homedir(), ".cache/ms-playwright");
	const directory = readdirSync(base).find((name) => name.startsWith("chromium_headless_shell"));
	if (!directory) {
		throw new Error("Instale o Chromium do Playwright antes de renderizar.");
	}
	const platform = readdirSync(join(base, directory)).find((name) => name.startsWith("chrome"));
	if (!platform) {
		throw new Error("Executável do Chromium não encontrado.");
	}
	const browser = await chromium.launch({
		executablePath: join(base, directory, platform, "chrome-headless-shell"),
		args: ["--enable-gpu", "--use-angle=vulkan", "--disable-vulkan-surface"],
		ignoreDefaultArgs: ["--enable-unsafe-swiftshader"],
	});

	try {
		const session = await browser.newBrowserCDPSession();
		const { gpu } = await session.send("SystemInfo.getInfo");
		const canvas = gpu.featureStatus?.["2d_canvas"];
		const raster = gpu.featureStatus?.rasterization;
		if (!canvas?.startsWith("enabled") || !raster?.startsWith("enabled")) {
			throw new Error(`Aceleração indisponível. Canvas: ${canvas}; rasterização: ${raster}`);
		}
		console.log(`[GPU] Canvas: ${canvas}; rasterização: ${raster}`);
		await session.detach();
		return browser;
	} catch (error) {
		await browser.close();
		throw error;
	}
}

export async function openRenderScene({ browser, baseURL, scene, width, height }: { browser: Browser; baseURL: string; scene: string; width: number; height: number }) {
	const page = await browser.newPage({ viewport: { width, height } });
	page.on("pageerror", (error) => console.error("[cena]", error.message));
	// MOTION_PARAMS="opcao=b" chega à cena na URL: é assim que uma alternativa de cena é renderizada.
	const params = process.env.MOTION_PARAMS ? `&${process.env.MOTION_PARAMS}` : "";
	await page.goto(`${baseURL}/scenes/${scene}/index.html?render${params}`);
	await page.waitForFunction(() => window.ready === true, null, { timeout: 30_000 });
	const gpu = await page.evaluate(() => window.motionRenderer.gpu);
	if (/swiftshader|llvmpipe|softpipe|software/i.test(gpu.renderer)) {
		throw new Error(`O navegador selecionou renderização por software: ${gpu.renderer}`);
	}
	console.log(`[GPU] ${gpu.renderer}`);
	return page;
}
