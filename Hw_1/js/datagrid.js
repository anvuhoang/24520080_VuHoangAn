import { initKeyboardNavigation } from './keyboard-nav.js';

export class DataGrid {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container
   * @param {Array<Object>} options.data
   * @param {Array} options.columns
   * @param {string} options.ariaLabel
   * @param {function} [options.onRowSelect]
   */
  constructor({ container, data, columns, ariaLabel, onRowSelect }) {
    this.container = container;
    this.data = data;
    this.columns = columns;
    this.ariaLabel = ariaLabel;
    this.onRowSelect = onRowSelect;

    this.sortColumn = null;
    this.sortDirection = 'asc';
    this.currentPage = 1;
    this.pageSize = 5;

    this.render();
  }

  getProcessedData() {
    let result = [...this.data];

    // Sắp xếp
    if (this.sortColumn) {
      result.sort((a, b) => {
        let valA = a[this.sortColumn];
        let valB = b[this.sortColumn];
        if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // Phân trang
    const start = (this.currentPage - 1) * this.pageSize;
    return {
      totalRows: result.length,
      paginatedData: result.slice(start, start + this.pageSize)
    };
  }

  render() {
    const { totalRows, paginatedData } = this.getProcessedData();
    const totalPages = Math.ceil(totalRows / this.pageSize) || 1;

    this.container.innerHTML = `
      <div class="datagrid-container">
        <table role="grid" aria-label="${this.ariaLabel}" class="enterprise-table">
          <thead role="rowgroup">
            <tr role="row">
              ${this.columns.map(col => `
                <th scope="col" role="columnheader" data-key="${col.accessorKey}">
                  ${col.header} ${col.sortable ? '↕' : ''}
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody role="rowgroup">
            ${paginatedData.map((row, rIdx) => `
              <tr role="row" tabindex="0">
                ${this.columns.map((col, cIdx) => `
                  <td role="gridcell" tabindex="${rIdx === 0 && cIdx === 0 ? '0' : '-1'}">
                    ${row[col.accessorKey]}
                  </td>
                `).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="pagination-controls">
          <span>Trang ${this.currentPage} / ${totalPages}</span>
          <div>
            <button id="prev-btn" ${this.currentPage === 1 ? 'disabled' : ''}>Trang trước</button>
            <button id="next-btn" ${this.currentPage >= totalPages ? 'disabled' : ''}>Trang sau</button>
          </div>
        </div>
      </div>
    `;

    this.attachEvents();
  }

  attachEvents() {
    const table = this.container.querySelector('table');
    
    // Gắn sự kiện Keyboard Navigation
    initKeyboardNavigation(table);

    // Gắn sự kiện sắp xếp cột
    this.container.querySelectorAll('th[data-key]').forEach(th => {
      const key = th.getAttribute('data-key');
      const col = this.columns.find(c => c.accessorKey === key);
      if (col && col.sortable) {
        th.addEventListener('click', () => {
          if (this.sortColumn === key) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
          } else {
            this.sortColumn = key;
            this.sortDirection = 'asc';
          }
          this.render();
        });
      }
    });

    // Gắn sự kiện phân trang
    const prevBtn = this.container.querySelector('#prev-btn');
    const nextBtn = this.container.querySelector('#next-btn');

    prevBtn?.addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.render();
      }
    });

    nextBtn?.addEventListener('click', () => {
      const totalPages = Math.ceil(this.data.length / this.pageSize);
      if (this.currentPage < totalPages) {
        this.currentPage++;
        this.render();
      }
    });

    // Gắn sự kiện chọn dòng
    if (this.onRowSelect) {
      this.container.querySelectorAll('tbody tr').forEach((tr, index) => {
        tr.addEventListener('click', () => {
          const paginated = this.getProcessedData().paginatedData;
          this.onRowSelect(paginated[index]);
        });
      });
    }
  }
}