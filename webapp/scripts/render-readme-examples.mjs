/** Export the README examples using the running visualiser's own download controls. */
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const root = new URL("../../", import.meta.url);
const output = new URL("docs/images/", root);
const readme = await readFile(new URL("README.md", root), "utf8");
const examples = [
  {
    name: "chromosome-and-plasmid",
    text: '()chr1, {}pBAD[type="plasmid"]',
    view: "Circular",
  },
  {
    name: "nested-containment",
    text: `{\n  { {}blaKPC-3[type="gene"] }Tn4401[type="transposon"]\n}pKpQIL[type="plasmid"]`,
    view: "Containment",
  },
  {
    name: "two-cells",
    text: '()chr1, {}pA[type="plasmid"] ; ()chr2, {}pB[type="plasmid"]',
    view: "Circular",
  },
];

await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(process.argv[2] || "http://localhost:5173");
  for (const example of examples) {
    if (!readme.includes(`\n${example.text}\n`)) {
      throw new Error(`README text does not match the ${example.name} example.`);
    }
    await page.locator(".cellgen-editor").fill(example.text);
    await page.getByRole("button", { name: example.view, exact: true }).click();
    await page.locator(".svg-viewer svg").waitFor();
    if (await page.locator(".validation-error").count()) {
      throw new Error(`Invalid example: ${example.name}`);
    }
    for (const extension of ["svg", "png"]) {
      const downloading = page.waitForEvent("download");
      await page.getByRole("button", { name: `Download ${extension.toUpperCase()}`, exact: true }).click();
      const download = await downloading;
      await download.saveAs(fileURLToPath(new URL(`${example.name}.${extension}`, output)));
    }
    console.log(`Exported ${example.name} (${example.view.toLowerCase()}).`);
  }
} finally {
  await browser.close();
}
