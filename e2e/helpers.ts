import { expect, type Locator, type Page } from '@playwright/test';

/** Replaces the contents of the (first) CodeMirror editor inside `scope`, or on the page. */
export async function setEditorSource(page: Page, source: string, scope?: Locator) {
  const editor = (scope ?? page.locator('body')).locator('.cm-content').first();
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  // One input event with the whole text, so auto-indent and bracket closing don't rewrite it.
  await page.keyboard.insertText(source);
  await expect(editor).toContainText(source.split('\n')[0]!);
}

/** Waits for the (first) run panel inside `scope`, or on the page, to finish and returns it. */
export async function finishedRunPanel(page: Page, scope?: Locator) {
  const panel = (scope ?? page.locator('body')).locator('.run-panel').first();
  await expect(panel).toHaveAttribute('aria-busy', 'false');
  return panel;
}
