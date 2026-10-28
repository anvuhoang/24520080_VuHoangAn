# Project Rules & Guidelines - HW 1

1. **Semantic HTML First (Zero Div-Soup):**
   - Nghiêm cấm sử dụng các thẻ `<div>` hoặc `<span>` để giả lập cấu trúc bảng dữ liệu. Bắt buộc sử dụng đúng tổ hợp thẻ HTML5 native: `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th scope="col">`, `<td>`, `<button>`.

2. **Accessibility & WCAG 2.2 AA Compliance:**
   - Mọi tương tác trên Data-Grid phải hỗ trợ thao tác chuột và bàn phím đầy đủ.
   - Độ tương phản màu chữ và nền tối thiểu phải đạt chuẩn **4.5:1**[cite: 1].
   - Đầy đủ ngữ nghĩa ARIA roles (`role="grid"`, `role="row"`, `role="gridcell"`)[cite: 1].

3. **Performance & Code Quality:**
   - Sử dụng hoàn toàn Vanilla JavaScript (ES6+ Modules) và Modern CSS (Grid/Flexbox).
   - Không sử dụng các framework nặng như React/Vue để giữ độ nguyên bản của bài lab.
   - Mục tiêu Lighthouse Audit: Đạt điểm tuyệt đối **100/100** ở mục *Accessibility* và *Best Practices*[cite: 1].