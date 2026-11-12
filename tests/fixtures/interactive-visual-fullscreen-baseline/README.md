# Complete fullscreen layout reference

Source: `bff7f9a`, the parent of `9ee7184`. Captured from an isolated Git-archive copy of the actual Next16 application, with the original host TSX/CSS, root/global styles, production adapters, common persistence and an owned disposable guest database. No activity code was changed. Browser: repository Playwright1.58 WebKit on macOS, iPhone13 user agent/touch emulation, DPR1, reduced motion, 320×568 /375×667 /390×844 /390×600 CSS pixels. These are browser checks, not physical iPhone evidence.

Each PNG is the **entire viewport**, including host title, all mathematical content and overflow. The only reference-only CSS changes suppress original generic button/status paint and make the original generic header/footer backgrounds transparent, reflecting the explicitly approved control redesign. `visibility:hidden` preserves original control/status layout allocations. Nothing is cropped; no mathematical element/region is hidden, repositioned or masked. Actual unmodified before/after whole-screen screenshots were also captured and inspected during the investigation.

`geometry.json` records absolute viewport rectangles, the visible host title, measured content dimensions passed to the adapters, headings, paragraphs, inputs, sliders and SVGs. It includes calibration elements so layout dependencies remain observable. The regression compares these along with full-viewport pixel equality. Screenshots are platform-scoped to macOS WebKit; other portable host/layout tests remain separate.

Do not update these references from the current implementation merely to accept a failing comparison. Reconstruct the original Git tree in an isolated temporary copy, exclude environment files, use an owned disposable test database, and capture identical states/viewport with only the generic paint suppression documented above. Verify all original mathematical rectangles are unchanged before taking reference screenshots. No existing review/production data should be used or reset.

Run the targeted regression with the existing runner:

```sh
node --import tsx scripts/test-phase2.ts --visuals visual-fullscreen-geometry.browser.ts --browser=webkit --reporter=list
```
