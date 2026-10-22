# DWG SKETCH — FONT HF1 — RELEASE NOTES

**Ngày:** 22/10/2026  
**Baseline xác nhận:** C# 0.18.22.0 / PWA 0.22.22 (Sandbox Foundation)  
**Nhánh:** FONT HF1; intentionally retains assembly/PWA identity numbers so the existing stable baseline and Windows release/build gates remain compatible.

## Tính năng được bổ sung

**C# Windows:**
- Quản lý font chữ ở bảng thuộc tính: danh sách họ font Windows; nhập font; áp dụng cho TEXT/MTEXT lớp phủ, TEXT/MTEXT DWG và DIMENSION, kể cả khi chọn nhiều đối tượng.
- Chữ tạo mới lấy font đang chọn; thuộc tính chữ và font được lưu bằng `FontName` trong Project JSON v11. Chỉnh thuộc tính có thể Undo bằng V0.18.2 selection transaction.
- Nút kiểm tra font hiển thị tên font không tìm thấy trong danh sách đã cài.
- `PdfUseSafeFontCheckBox` mặc định **không chọn**: không ép Segoe UI khi xuất. Nếu chủ động bật, xuất PNG/Clipboard/PDF và in trực tiếp sử dụng cùng tên font đang chọn. `GetOutputTypeface()` (Skia) và `DrawVectorText()` (WPF) dùng cùng `OutputFontFamilyHF1`.

**PWA:**
- Font manager với font cho chữ mới, áp dụng font cho chữ chọn đơn/lô, chỉnh trong hộp thoại text và thuộc tính text.
- Nạp TTF/OTF/WOFF/WOFF2 (file <= 6 MB), `FontFace.load()` rồi lưu IndexedDB theo tên family, khôi phục khi mở lại và xóa bản font đã nạp.
- `preserve` giữ font riêng của từng đối tượng khi xuất; `override` dùng font tại font manager khi xuất.
- PNG và Clipboard dùng chung `renderExportCanvas`; PDF/in SVG dùng cùng family và có `@font-face` data URL cho font đã nạp. Chờ `document.fonts.ready` trước khi in vector. Trong PDF Chromium, có thể nhúng subset TrueType đã nạp.
- Cấu hình font được ghi vào `project.display` theo schema dự án v11 và user profile, không làm thay đổi schema.
- Service-worker cache revision mới để trình duyệt lấy HTML HF1.

## Giới hạn và ngoại lệ

- Ứng dụng C# **không tự cài đặt font Windows**. Người dùng cần cài đặt font có giấy phép phù hợp trong hệ điều hành trước khi chọn.
- Font SHX không phải OpenType/TrueType: không tự nhúng, sẽ có thay thế Unicode. Cần kiểm tra thủ công những bản vẽ dùng SHX hoặc glyph đặc biệt.
- PWA IndexedDB là thư viện theo trình duyệt và origin, không đi kèm JSON dự án. Chuyển sang máy khác phải cài/nạp cùng font. SVG/PDF được tạo tại máy có font. File PDF sau khi tạo có thể tự chứa subset font nếu công cụ in hỗ trợ.
- PWA không lưu tệp font nhị phân vào gói phát hành. Không tái phân phối font thương mại.
- Thay family font có thể làm đổi width/height của glyph, ảnh hưởng bố cục MTEXT/anchor nếu khác metrics nguồn AutoCAD. Cần so sánh trước/sau.
- Chế độ in SVG PDF dùng cơ chế in PDF của trình duyệt, không phải PDF generator riêng. Mức độ nhúng font phụ thuộc trình duyệt và quyền nhúng font; kiểm tra PDF đầu ra bằng pdffonts hoặc xem trực quan.

## Bảo toàn baseline

- Không thay đổi DWG worker, engine màu sắc, geometry, macro sandbox, schema JSON v11 hoặc bộ xác minh parity lõi.
- Embedded PWA và PWA standalone index/sw được đồng bộ byte-for-byte.
- Mức tăng số lượng file C# 83 -> 84 được cập nhật ở verify_release.ps1.

## Build

1. Giải nén gói ZIP vào thư mục **mới**; tránh ghi đè bản đã chạy tốt.
2. Chạy `CSharp_Source/DwgSketchPrototype/build_release.cmd` trên Windows có .NET 8 SDK để build/publish và thực thi verify.
3. Nhánh PWA độc lập: chạy `PWA_Standalone/serve_local.cmd` hoặc host HTTPS, hard refresh lần đầu để cập nhật service worker.
4. Không phát hành thay bản ổn định cũ trước khi xác nhận với DWG thực tế và fonts Windows của máy sử dụng.
