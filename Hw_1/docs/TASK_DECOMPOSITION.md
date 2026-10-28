# Task Decomposition - HW 1: Production Enterprise Data-Grid

## Phase 1: Setup & Contract Definition
- [x] Khởi tạo cấu trúc thư mục dự án theo chuẩn Semantic HTML & Vanilla Stack.
- [x] Định nghĩa cấu trúc dữ liệu và interface/contract cho `ColumnDef` và `DataGridProps`[cite: 1].

## Phase 2: Semantic HTML & CSS Layout
- [x] Xây dựng khung giao diện chính tại `index.html` sử dụng hoàn toàn thẻ native (`<table>`, `<thead>`, `<tbody>`, `<th scope="col">`) — tránh tuyệt đối div-soup[cite: 1].
- [x] Thiết lập hệ thống biến CSS (`variables.css`) đảm bảo độ tương phản màu sắc tối thiểu **4.5:1** (chuẩn WCAG 2.2 AA)[cite: 1].

## Phase 3: Core Logic (Sorting, Filtering, Pagination)
- [x] Xây dựng logic **Sorting** (tăng dần/giảm dần) khi click vào header cột.
- [x] Xây dựng logic **Filtering** theo từ khóa.
- [x] Xây dựng logic **Pagination** (chia trang dữ liệu).

## Phase 4: Keyboard Navigation & Accessibility (WCAG 2.2 AA)
- [x] Viết mô đun điều hướng bàn phím (`keyboard-nav.js`) cho phép dùng phím mũi tên `Up`/`Down`/`Left`/`Right` di chuyển giữa các ô `gridcell`[cite: 1].
- [x] Cấu hình phím `Enter` để chọn dòng (`onRowSelect`) và phím `Space` để bật/tắt (toggle)[cite: 1].
- [x] Bổ sung đầy đủ các ARIA attributes (`role="grid"`, `role="row"`, `role="gridcell"`, `aria-label`)[cite: 1].

## Phase 5: Audit & Final Review
- [x] Kiểm tra điểm số Lighthouse (mục *Accessibility* và *Best Practices* đạt 100/100)[cite: 1].