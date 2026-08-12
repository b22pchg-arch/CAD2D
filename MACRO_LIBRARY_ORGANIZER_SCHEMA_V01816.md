# Macro Library Organizer V0.18.16

Macro storage remains `dwg-sketch-cad-macros` and advances to schemaVersion 9 / engineVersion 0.18.16.0.

Portable macro metadata added to each macro:
- `category: string`
- `tags: string[]`
- `isFavorite: bool`
- `runCount: int`
- `lastRunAt: DateTimeOffset?`

Category/tags/favorite are library metadata. Run statistics are persisted locally/exported with the macro for diagnostics. Concrete runtime role entity references are still never serialized.

Backward compatibility: missing fields normalize to empty category/tags, favorite=false, runCount=0, lastRunAt=null. Project JSON remains version 11.
