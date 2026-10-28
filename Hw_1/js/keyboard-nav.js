/**
 * Quản lý điều hướng bàn phím cho Data-Grid (Mũi tên, Enter, Space)
 * @param {HTMLTableElement} tableElement 
 */
export function initKeyboardNavigation(tableElement) {
  const getCells = () => Array.from(tableElement.querySelectorAll('td[role="gridcell"]'));
  
  tableElement.addEventListener('keydown', (e) => {
    const cells = getCells();
    const activeElement = document.activeElement;
    
    if (!cells.includes(activeElement)) return;

    const rows = Array.from(tableElement.querySelectorAll('tr[role="row"]')).slice(1); // Bỏ qua thead
    const currentRowIndex = rows.findIndex(row => row.contains(activeElement));
    const currentRow = rows[currentRowIndex];
    const currentCellsInRow = Array.from(currentRow.querySelectorAll('td[role="gridcell"]'));
    const currentColIndex = currentCellsInRow.indexOf(activeElement);

    let targetCell = null;

    switch (e.key) {
      case 'ArrowDown':
        if (currentRowIndex < rows.length - 1) {
          const nextRowCells = rows[currentRowIndex + 1].querySelectorAll('td[role="gridcell"]');
          targetCell = nextRowCells[currentColIndex];
        }
        break;
      case 'ArrowUp':
        if (currentRowIndex > 0) {
          const prevRowCells = rows[currentRowIndex - 1].querySelectorAll('td[role="gridcell"]');
          targetCell = prevRowCells[currentColIndex];
        }
        break;
      case 'ArrowRight':
        if (currentColIndex < currentCellsInRow.length - 1) {
          targetCell = currentCellsInRow[currentColIndex + 1];
        }
        break;
      case 'ArrowLeft':
        if (currentColIndex > 0) {
          targetCell = currentCellsInRow[currentColIndex - 1];
        }
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        currentRow.click(); // Kích hoạt sự kiện chọn dòng
        break;
      default:
        return;
    }

    if (targetCell) {
      e.preventDefault();
      targetCell.focus();
    }
  });
}