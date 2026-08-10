# Vietnamese Encoding Normalizer V0.18.5.3

Muc tieu: dua TEXT/MTEXT CAD cu ve Unicode NFC ma khong lam hong noi dung Unicode dang dung.

## Che do

- `AUTO`: ket hop style/font hint va dau hieu noi dung, co confidence threshold.
- `TCVN3`: ABC/.VnTime/.VnArial va cac font `.Vn*`.
- `VNI`: VNI-Windows, thuong di kem font `VNI-*`.
- `VIQR`: chuoi ASCII kieu `a^'`, `o+`, `dd`.
- `Unicode`: khong doi bang ma, chi normalize NFC va co the doi font.

## Quy tac AUTO an toan

1. Font/style VNI hoac `.Vn*` la dau hieu manh.
2. VNI token nhieu ky tu duoc cham diem truoc TCVN3 de tranh cung mot ky tu Latin-1 bi map nham.
3. Neu chuoi da co ky tu tieng Viet Unicode hop le va khong co dau hieu legacy ro rang, giu Unicode.
4. Chu ky thuat ASCII nhu `373-7/01`, `LBS`, `TBA 01` duoc giu nguyen.
5. Nguoi dung co the ep mode khi metadata font cua ban ve cu khong con chinh xac.

## Round-trip

C# CadText luu them cac truong tuy chon `SourceTextStyleName`, `SourceTextFontFile`, `SourceTextEncoding`, `SourceTextConverted`. Day la extension tuong thich nguoc; project schema van version 11.

PWA giu metadata source text tren entity va dung cung logic AUTO/forced conversion.

## Undo

Chuyen hang loat trong C# dung mot Undo snapshot; PWA dung `simpleAction`, nen co the Ctrl+Z sau batch conversion.
