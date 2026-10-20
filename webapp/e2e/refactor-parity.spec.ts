/** Compare a refactor with an independently served baseline checkout. */
import { readFile, writeFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

const baselineURL = process.env.CELLGEN_BASELINE_URL;
test.skip(!baselineURL, "Set CELLGEN_BASELINE_URL to an untouched baseline server.");

for (const width of [1280, 390]) {
  for (const theme of ["light", "dark"]) {
    test(`unchanged interface and workflows at ${width}px in ${theme} mode`, async ({
      page,
      context,
    }, testInfo) => {
      test.setTimeout(120_000);
      const baseline = await context.newPage();
      const pages = [baseline, page];
      for (const current of pages) {
        await current.setViewportSize({ width, height: 900 });
        await current.addInitScript((value) => {
          localStorage.setItem("cellgen-theme", value);
        }, theme);
      }
      await baseline.goto(baselineURL!);
      await page.goto("/");
      const compare = async (name: string) => {
        for (const current of pages) await current.locator(".builder").waitFor();
        const readState = (current: Page) =>
          current.locator(".app").evaluate((root) => ({
            text: (root as HTMLElement).innerText,
            controls: [...root.querySelectorAll("input, textarea, select, button")].map((node) => ({
              tag: node.tagName,
              value: "value" in node ? node.value : null,
              checked: "checked" in node ? node.checked : null,
              disabled: "disabled" in node ? node.disabled : null,
            })),
            svg: root.querySelector(".svg-viewer")?.innerHTML,
          }));
        await expect
          .poll(async () => JSON.stringify(await readState(page)))
          .toBe(JSON.stringify(await readState(baseline)));
        const capture = async (current: Page) => {
          await current.bringToFront();
          await current.mouse.move(0, 0);
          await current.evaluate(() => {
            (document.activeElement as HTMLElement | null)?.blur();
            window.getSelection()?.removeAllRanges();
            window.scrollTo(0, 0);
          });
          return current.screenshot({ fullPage: true, animations: "disabled" });
        };
        let before: Buffer;
        let after: Buffer;
        try {
          await expect
            .poll(
              async () => {
                before = await capture(baseline);
                after = await capture(page);
                if (after.equals(before)) return true;
                // Chromium can round antialiased native control edges by 1–2 RGB levels.
                // Compare every pixel; allow only that rounding, not displaced content.
                return page.evaluate(
                  async ({ beforeURL, afterURL }) => {
                    const decode = async (url: string) => {
                      const image = await createImageBitmap(await (await fetch(url)).blob());
                      const canvas = document.createElement("canvas");
                      canvas.width = image.width;
                      canvas.height = image.height;
                      const context = canvas.getContext("2d")!;
                      context.drawImage(image, 0, 0);
                      return {
                        width: image.width,
                        height: image.height,
                        pixels: context.getImageData(0, 0, image.width, image.height).data,
                      };
                    };
                    const [left, right] = await Promise.all([decode(beforeURL), decode(afterURL)]);
                    return (
                      left.width === right.width &&
                      left.height === right.height &&
                      left.pixels.every(
                        (value, index) => Math.abs(value - right.pixels[index]) <= 2,
                      )
                    );
                  },
                  {
                    beforeURL: `data:image/png;base64,${before.toString("base64")}`,
                    afterURL: `data:image/png;base64,${after.toString("base64")}`,
                  },
                );
              },
              { message: `${name}: screenshot must match baseline pixels` },
            )
            .toBe(true);
        } catch (error) {
          await writeFile(testInfo.outputPath("baseline.png"), before!);
          await writeFile(testInfo.outputPath("refactor.png"), after!);
          throw error;
        }
      };
      const both = async (action: (current: Page) => Promise<unknown>) => {
        for (const current of pages) await action(current);
      };
      await compare("initial");
      const examples = await baseline.locator(".example-btn").allTextContents();
      for (const example of examples) {
        await both((current) =>
          current.getByRole("button", { name: example.trim(), exact: true }).click(),
        );
        await compare(example.trim());
      }
      await both((current) =>
        current.getByRole("button", { name: "Containment", exact: true }).click(),
      );
      await compare("containment");
      for (const input of [
        "()knownChromosome,{}pTest",
        "(incomplete",
        "",
        '({{}gene[type="gene",note="keep"]}Tn21[type="transposon"])chr',
      ]) {
        await both((current) => current.locator(".cellgen-editor").fill(input));
        await compare("text-edit");
      }
      await both((current) => current.getByRole("button", { name: "gene", exact: true }).click());
      await compare("edit-modal");
      await both((current) => current.locator(".builder-modal-input").first().fill("renamedGene"));
      await both((current) => current.getByRole("button", { name: "Save", exact: true }).click());
      await compare("nested-rename");
      await both((current) =>
        current.getByRole("button", { name: "+ Add cell", exact: true }).click(),
      );
      await compare("add-cell");
      await both((current) =>
        current.getByRole("button", { name: "+ Add entity", exact: true }).last().click(),
      );
      await both((current) => current.locator(".builder-modal-select").selectOption("plasmid"));
      await both((current) => current.locator(".builder-modal-input").first().fill("pAdded"));
      await both((current) => current.locator("input[type=color]").fill("#ff0000"));
      await both((current) => current.getByRole("button", { name: "Add", exact: true }).click());
      await compare("add-coloured-plasmid");
      await both((current) =>
        current
          .locator(".entity-card")
          .filter({ has: current.getByRole("button", { name: "pAdded", exact: true }) })
          .locator(".builder-remove-btn")
          .first()
          .click(),
      );
      await compare("remove-plasmid");
      await both((current) =>
        current.getByRole("button", { name: "+ Import GenBank / GFF" }).click(),
      );
      await compare("import-panel");
      await both((current) =>
        current.getByLabel("Choose file").setInputFiles({
          name: "bad.gff3",
          mimeType: "text/plain",
          buffer: Buffer.from("invalid"),
        }),
      );
      await both((current) =>
        current.getByRole("button", { name: "Import selected file" }).click(),
      );
      await compare("bad-import");
      await both((current) =>
        current
          .getByLabel("Choose file")
          .setInputFiles(new URL("../../tests/fixtures/assembly.gbk", import.meta.url).pathname),
      );
      await both((current) => current.getByLabel(/Retain specific genes/).fill("coreA"));
      await both((current) =>
        current.getByRole("button", { name: "Import selected file" }).click(),
      );
      for (const current of pages)
        await expect(current.getByRole("status")).toContainText("Imported");
      await compare("selected-gene-import");
      await both((current) => current.getByRole("button", { name: "− Hide import" }).click());
      await compare("hidden-import-summary");
      for (const format of [".txt", "SVG", "PNG"]) {
        const files: Buffer[] = [];
        for (const current of pages) {
          const downloading = current.waitForEvent("download");
          await current.getByRole("button", { name: `Download ${format}`, exact: true }).click();
          const download = await downloading;
          files.push(await readFile((await download.path())!));
        }
        expect(files[1].equals(files[0]), `${format} download must be byte-identical`).toBe(true);
      }
      for (const current of pages) {
        await current.clock.install();
        await current.clock.pauseAt(new Date());
        await context.grantPermissions(["clipboard-read", "clipboard-write"], {
          origin: new URL(current.url()).origin,
        });
        await current.bringToFront();
        await current.getByRole("button", { name: "Copy", exact: true }).click();
        await expect(current.getByRole("button", { name: "Copied!", exact: true })).toBeVisible();
        await current.locator(".cellgen-editor").fill("()afterCopy");
        await expect(current.getByRole("button", { name: "Copied!", exact: true })).toBeVisible();
        await current.clock.fastForward(1500);
        await expect(current.getByRole("button", { name: "Copy", exact: true })).toBeVisible();
        await current.clock.resume();
      }
      await compare("copy-feedback-and-subsequent-edit");
      await baseline.close();
    });
  }
}
