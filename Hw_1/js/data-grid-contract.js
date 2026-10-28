/**
 * @typedef {Object} ColumnDef
 * @property {string} header - Tiêu đề cột
 * @property {string} accessorKey - Khóa truy xuất dữ liệu từ object
 * @property {boolean} [sortable] - Cho phép sắp xếp hay không
 */

/**
 * @typedef {Object} DataGridProps
 * @property {Array<Object>} data - Mảng dữ liệu hiển thị
 * @property {Array<ColumnDef>} columns - Cấu hình các cột
 * @property {function(Object): void} [onRowSelect] - Sự kiện khi chọn dòng
 * @property {string} ariaLabel - Nhãn ARIA mô tả bảng
 */