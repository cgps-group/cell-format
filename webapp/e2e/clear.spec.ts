import { test, expect } from "@playwright/test";

const assembly = new URL("../../tests/fixtures/assembly.gbk", import.meta.url).pathname;

test("Clear resets examples, invalid drafts and builder edits, and permits a fresh record", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Two cells", exact: true }).click();
  await page.getByRole("button", { name: "Containment", exact: true }).click();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  const editor = page.locator(".cellgen-editor");
  await expect(editor).toHaveValue("");
  await expect(editor).toBeFocused();
  await expect(page.locator(".builder-cell")).toHaveCount(1);
  await expect(page.locator(".builder-label-btn")).toHaveCount(0);
  await expect(page.locator(".svg-viewer svg")).toHaveCount(0);
  await expect(page.locator(".validation-error")).toHaveCount(0);
  await expect(
    page.getByText("Add an entity or enter a CellGen string to see the diagram"),
  ).toBeVisible();
  for (const name of ["Download .txt", "Download SVG", "Download PNG", "Copy"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeDisabled();
  }
  await expect(page.getByRole("button", { name: "Containment", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "+ Add entity", exact: true }).click();
  await page.locator(".builder-modal-input").first().fill("freshChromosome");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(editor).toHaveValue("()freshChromosome");
  await expect(page.locator(".svg-viewer svg")).toBeVisible();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.locator(".builder-label-btn")).toHaveCount(0);
  await editor.fill("(invalid");
  await expect(page.locator(".validation-error")).toBeVisible();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.locator(".validation-error")).toHaveCount(0);
});

test("Clear resets a selected import and its options, and the same file can be imported again", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "+ Import GenBank / GFF" }).click();
  const picker = page.getByLabel("Choose file");
  await picker.setInputFiles(assembly);
  await page.getByLabel("Retain all genes outside annotated mobile elements").check();
  await page.getByLabel(/Retain specific genes/).fill("coreA");
  await page.getByRole("button", { name: "Import selected file", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Imported");
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.locator(".cellgen-editor")).toHaveValue("");
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.locator(".file-upload-selection")).toHaveCount(0);
  await expect
    .poll(() => picker.evaluate((input: HTMLInputElement) => input.files?.length))
    .toBe(0);
  await expect(page.getByLabel(/Retain specific genes/)).toHaveValue("");
  await expect(
    page.getByLabel("Retain all genes outside annotated mobile elements"),
  ).not.toBeChecked();
  await expect(
    page.getByRole("button", { name: "Import selected file", exact: true }),
  ).toBeDisabled();
  await picker.setInputFiles(assembly);
  await page.getByRole("button", { name: "Import selected file", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Imported");
  await expect(page.locator(".svg-viewer svg")).toBeVisible();
  await picker.setInputFiles({
    name: "invalid.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an annotation"),
  });
  await page.getByRole("button", { name: "Import selected file", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("a file read that finishes after Clear cannot restore the old record", async ({ page }) => {
  await page.addInitScript(() => {
    const OriginalReader = window.FileReader;
    const deferred = window as typeof window & { completeRead: () => Promise<void> };
    window.FileReader = class extends OriginalReader {
      readAsText(file: Blob) {
        deferred.completeRead = () =>
          new Promise<void>((resolve) => {
            this.addEventListener("loadend", () => resolve(), { once: true });
            super.readAsText(file);
          });
      }
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "+ Import GenBank / GFF" }).click();
  await page.getByLabel("Choose file").setInputFiles(assembly);
  await page.getByRole("button", { name: "Import selected file", exact: true }).click();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await page.evaluate(() =>
    (window as typeof window & { completeRead: () => Promise<void> }).completeRead(),
  );
  await expect(page.locator(".cellgen-editor")).toHaveValue("");
  await expect(page.locator(".svg-viewer svg")).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveCount(0);
});
