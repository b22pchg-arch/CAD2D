# DWG Sketch Versioned Symbol Library V0.18.4

## Mục tiêu
V0.18.4 đặt nền tương thích cho thư viện thiết bị/ký hiệu có phiên bản, nhưng **không đổi Project JSON v11** và không phá thư viện schema v1 cũ.

## Envelope schema v2
```json
{
  "schema": "dwg-sketch-electrical-symbol-library",
  "schemaVersion": 2,
  "libraryVersion": "1.0.0",
  "appVersion": "0.18.4",
  "exportedAt": "2026-08-09T17:56:00+07:00",
  "templates": []
}
```

## Metadata mỗi template
- `Id`: khóa ổn định của mẫu.
- `Name`: tên hiển thị.
- `Version`: semantic version của định nghĩa mẫu, mặc định `1.0.0`.
- `Revision`: số lần chỉnh sửa cục bộ; mỗi lần lưu đè cùng `Id` được tăng 1.
- `Category`: nhóm thiết bị, mặc định `Custom`.
- `Tags`: danh sách nhãn để chuẩn bị tìm kiếm/lọc thư viện.
- `UpdatedAt`: thời điểm sửa gần nhất.
- `Primitives`, `Ports`, `LabelPosition`, `LabelHeight`: hình học và kết nối như schema v1.

## Tương thích
- C# và PWA vẫn nhập được thư viện schema v1; metadata thiếu sẽ tự nhận giá trị mặc định.
- PWA giữ `version/revision/category/tags` khi lưu vào localStorage và project snapshot.
- Export mới sử dụng schema v2.
- Không tự động nâng `Version` semantic khi chỉnh sửa; V0.18.4 chỉ tăng `Revision`. Việc quản lý major/minor/patch và history nhiều revision sẽ triển khai ở nhánh Macro/Library tiếp theo.

## Định hướng tiếp theo
1. Library catalog nhiều bộ thư viện, namespace và dependency.
2. Lưu nhiều revision của cùng template thay vì chỉ revision mới nhất.
3. Macro tham chiếu template bằng `Id + Version/Revision`.
4. Kiểm tra compatibility trước khi chèn hoặc cập nhật instance.
5. Công cụ diff/upgrade template instance trong bản vẽ.
