# MTEXT cap-height and paragraph parity — V0.18.5.4

V0.18.5.4 keeps DWG text geometry in CAD units and treats the host font only as a glyph provider.

## 1. CAD height is not host em-size

For each resolved typeface, the renderer measures capital `H` at a reference em-size and caches:

`emPerCadHeight = referenceEm / measuredCapHeight`

The final Skia/Canvas font size is:

`fontEmSize = cadTextHeight * emPerCadHeight`

This makes the visible cap height track the DWG text height instead of the host font's em-box.

## 2. First baseline is stable

The first baseline is derived from the cap-normalized first-line ink bounds. For MTEXT with `AtLeast` line spacing, `ActualHeight` does not move the first baseline. Instead:

`targetLastBaseline = ActualHeight - FirstTop - LastBottom`

The baseline gap is expanded, never compressed below the 3-on-5 base spacing.

## 3. Paragraph alignment survives import

Before MTEXT formatting commands are removed, the parser extracts `q` alignment from `\\p...;` paragraph formatting. `Center` and `Right` are then rendered inside `MTextReferenceWidth`.

Two optional fields are persisted in Project JSON v11:

- `MTextReferenceWidth`
- `MTextParagraphAlignment`

Older project files remain compatible because missing fields fall back to `0` and `Left`.

## 4. Attachment rectangle vs glyph transform

MTEXT attachment offsets belong to the CAD reference rectangle. They are rotated with the entity, but they are not multiplied again by glyph `WidthFactor` or oblique shear. Glyph width/oblique transforms are applied only while drawing the text itself.
