/**
 * CellGen webapp — end-to-end tests.
 * Run: npm run test:e2e
 */
import { test, expect } from '@playwright/test'

test.describe('page shell', () => {
  test('loads and shows the app title', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.app-header-name')).toBeVisible()
    await expect(page.getByText('Cellular Genome Organisation Visualiser')).toBeVisible()
  })

  test('shows GitHub link in header', async ({ page }) => {
    await page.goto('/')
    const link = page.getByRole('link', { name: 'GitHub' })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', /github\.com/)
  })

  test('About link navigates to /about page with authors', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'About' }).click()
    await expect(page).toHaveURL('/about')
    await expect(page.getByText('Centre for Genomic Pathogen Surveillance')).toBeVisible()
    await expect(page.getByText('Nabil-Fareed Alikhan')).toBeVisible()
    await expect(page.getByText('Julio Diaz Caballero')).toBeVisible()
  })

  test('About page back link returns to home', async ({ page }) => {
    await page.goto('/about')
    await page.getByRole('link', { name: '← Back' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.locator('.cellgen-editor')).toBeVisible()
  })
})

test.describe('format string / diagram', () => {
  test('shows SVG diagram for valid input', async ({ page }) => {
    await page.goto('/')
    await page.locator('.cellgen-editor').fill('()chr1')
    await expect(page.locator('.svg-viewer circle')).toBeVisible()
  })

  test('shows validation error for invalid input', async ({ page }) => {
    await page.goto('/')
    await page.locator('.cellgen-editor').fill('(unclosed')
    await expect(page.locator('.validation-error')).toBeVisible()
  })

  test('shows no error for valid nested format', async ({ page }) => {
    await page.goto('/')
    await page.locator('.cellgen-editor').fill('{ { {}blaKPC-2 }Tn4401 }pKpQIL')
    await expect(page.locator('.validation-error')).not.toBeVisible()
    await expect(page.locator('.svg-viewer svg')).toBeVisible()
  })

  test('example buttons load their format strings', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Two cells' }).click()
    const val = await page.locator('.cellgen-editor').inputValue()
    expect(val).toContain(';')
    const count = await page.locator('.svg-viewer circle').count()
    expect(count).toBeGreaterThanOrEqual(2)
  })

  test('Download SVG button is enabled for valid input', async ({ page }) => {
    await page.goto('/')
    await page.locator('.cellgen-editor').fill('()chr1')
    const btn = page.getByRole('button', { name: 'Download SVG' })
    await expect(btn).not.toBeDisabled()
  })

  test('Download SVG button is disabled for invalid input', async ({ page }) => {
    await page.goto('/')
    await page.locator('.cellgen-editor').fill('(bad')
    const btn = page.getByRole('button', { name: 'Download SVG' })
    await expect(btn).toBeDisabled()
  })
})

test.describe('interactive builder', () => {
  test('builder is shown by default with format string below', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Cell 1')).toBeVisible()
    await expect(page.getByRole('button', { name: '+ Add element' })).toBeVisible()
    await expect(page.locator('.cellgen-editor')).toBeVisible()
  })

  test('adding a chromosome updates the format string', async ({ page }) => {
    await page.goto('/')
    await page.locator('.cellgen-editor').fill('')
    await page.getByRole('button', { name: '+ Add element' }).click()
    await page.locator('.builder-modal-select').selectOption('chromosome')
    await page.locator('.builder-modal-input').first().fill('myChromosome')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    const val = await page.locator('.cellgen-editor').inputValue()
    expect(val).toContain('myChromosome')
  })

  test('adding a plasmid shows Add inside button', async ({ page }) => {
    await page.goto('/')
    await page.locator('.cellgen-editor').fill('')
    await page.getByRole('button', { name: '+ Add element' }).click()
    await page.locator('.builder-modal-select').selectOption('plasmid')
    await page.locator('.builder-modal-input').first().fill('pBAD')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByRole('button', { name: /Add inside pBAD/ })).toBeVisible()
  })

  test('can nest an element inside a plasmid', async ({ page }) => {
    await page.goto('/')
    await page.locator('.cellgen-editor').fill('')
    await page.getByRole('button', { name: '+ Add element' }).click()
    await page.locator('.builder-modal-select').selectOption('plasmid')
    await page.locator('.builder-modal-input').first().fill('pKpQIL')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await page.getByRole('button', { name: /Add inside pKpQIL/ }).click()
    await page.locator('.builder-modal-select').selectOption('transposon')
    await page.locator('.builder-modal-input').first().fill('Tn4401')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.locator('.builder-label-btn').filter({ hasText: 'Tn4401' })).toBeVisible()
    const val = await page.locator('.cellgen-editor').inputValue()
    expect(val).toContain('Tn4401')
    expect(val).toContain('pKpQIL')
  })

  test('typing in format string syncs to builder', async ({ page }) => {
    await page.goto('/')
    await page.locator('.cellgen-editor').fill('()chromosome1,{}plasmidA')
    await expect(page.locator('.builder-label-btn').filter({ hasText: 'chromosome1' })).toBeVisible()
    await expect(page.locator('.builder-label-btn').filter({ hasText: 'plasmidA' })).toBeVisible()
  })

  test('clicking a label opens edit modal', async ({ page }) => {
    await page.goto('/')
    await page.locator('.cellgen-editor').fill('()myChromosome')
    await page.locator('.builder-label-btn').filter({ hasText: 'myChromosome' }).click()
    await expect(page.getByText('Edit element')).toBeVisible()
    await expect(page.locator('.builder-modal-input').first()).toHaveValue('myChromosome')
  })

  test('editing a label updates the format string', async ({ page }) => {
    await page.goto('/')
    await page.locator('.cellgen-editor').fill('()oldName')
    await page.locator('.builder-label-btn').filter({ hasText: 'oldName' }).click()
    await page.locator('.builder-modal-input').first().fill('newName')
    await page.getByRole('button', { name: 'Save' }).click()
    const val = await page.locator('.cellgen-editor').inputValue()
    expect(val).toContain('newName')
    expect(val).not.toContain('oldName')
  })

  test('can add a second cell', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: '+ Add cell' }).click()
    await expect(page.getByText('Cell 2')).toBeVisible()
  })
})

test.describe('import section', () => {
  test('import toggle shows file upload widget', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: '+ Import GenBank / GFF' }).click()
    await expect(page.locator('.upload-row')).toBeVisible()
  })

  test('import toggle hides the upload widget when clicked again', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: '+ Import GenBank / GFF' }).click()
    await expect(page.locator('.upload-row')).toBeVisible()
    await page.getByRole('button', { name: '− Hide import' }).click()
    await expect(page.locator('.upload-row')).not.toBeVisible()
  })
})

test.describe('Klebsiella examples', () => {
  test('KPC in Tn4401 example renders nested arcs', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'KPC in Tn4401 (pKpQIL)' }).click()
    const val = await page.locator('.cellgen-editor').inputValue()
    expect(val).toContain('blaKPC-3')
    expect(val).toContain('Tn4401')
    expect(val).toContain('pKpQIL')
    await expect(page.locator('.svg-viewer svg')).toBeVisible()
    await expect(page.locator('.validation-error')).not.toBeVisible()
  })

  test('OXA-48 example loads and renders', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'OXA-48 in Tn1999' }).click()
    const val = await page.locator('.cellgen-editor').inputValue()
    expect(val).toContain('blaOXA-48')
    expect(val).toContain('Tn1999')
    await expect(page.locator('.validation-error')).not.toBeVisible()
  })

  test('CAV1193 example has multiple plasmids', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Kp CAV1193' }).click()
    const val = await page.locator('.cellgen-editor').inputValue()
    expect(val).toContain('CAV1193')
    expect(val).toContain('pKPC_CAV1193')
    expect(val).toContain('blaKPC-3')
    const circles = await page.locator('.svg-viewer circle').count()
    expect(circles).toBeGreaterThanOrEqual(2) // chromosome + plasmids
    await expect(page.locator('.validation-error')).not.toBeVisible()
  })

  test('fungal Starship example loads its nested captain and cargo', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Fungal Starship (schematic)' }).click()
    const val = await page.locator('.cellgen-editor').inputValue()
    expect(val).toContain('Starship[type="starship"')
    expect(val).toContain('DUF3435_captain')
    expect(val).toContain('cargo_gene_cluster')
    expect(val).toContain('Macrophomina phaseolina')
    await expect(page.locator('.svg-viewer svg')).toBeVisible()
    await expect(page.locator('.validation-error')).not.toBeVisible()
  })
})

test.describe('builder colour feature', () => {
  test('colour picker is shown in add modal for entity types', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: '+ Add element' }).click()
    await page.locator('.builder-modal-select').selectOption('plasmid')
    // colour input should be present (type=color)
    await expect(page.locator('input[type="color"]')).toBeVisible()
  })

  test('colour attribute appears in format string when non-default', async ({ page }) => {
    await page.goto('/')
    await page.locator('.cellgen-editor').fill('')
    await page.getByRole('button', { name: '+ Add element' }).click()
    await page.locator('.builder-modal-select').selectOption('plasmid')
    await page.locator('.builder-modal-input').first().fill('myPlasmid')
    // Set a custom colour via the text hex input
    await page.locator('input[type="text"]').nth(1).fill('#ff0000')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    const val = await page.locator('.cellgen-editor').inputValue()
    expect(val).toContain('myPlasmid')
    expect(val).toContain('colour="#ff0000"')
  })

  test('Element type is available when adding inside a plasmid', async ({ page }) => {
    await page.goto('/')
    await page.locator('.cellgen-editor').fill('')
    await page.getByRole('button', { name: '+ Add element' }).click()
    await page.locator('.builder-modal-select').selectOption('plasmid')
    await page.locator('.builder-modal-input').first().fill('pTest')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await page.getByRole('button', { name: /Add inside pTest/ }).click()
    await expect(page.locator('.builder-modal-select option[value="element"]')).toBeAttached()
  })

  test('top-level Add element offers chromosome and non-chromosomal entity types', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: '+ Add element' }).click()
    await expect(page.locator('.builder-modal-select option[value="chromosome"]')).toBeAttached()
    await expect(page.locator('.builder-modal-select option[value="plasmid"]')).toBeAttached()
    await expect(page.locator('.builder-modal-select option[value="transposon"]')).toBeAttached()
    await expect(page.locator('.builder-modal-select option[value="starship"]')).toBeAttached()
  })
})

test.describe('about page content', () => {
  test('About page shows lead paragraph', async ({ page }) => {
    await page.goto('/about')
    await expect(page.locator('.about-page-lead').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'The notation at a glance' })).toBeVisible()
  })

  test('About page shows notation table', async ({ page }) => {
    await page.goto('/about')
    await expect(page.locator('.about-table')).toBeVisible()
  })

  test('About page shows why it matters section', async ({ page }) => {
    await page.goto('/about')
    await expect(page.getByRole('heading', { name: 'Why it matters' })).toBeVisible()
  })
})
