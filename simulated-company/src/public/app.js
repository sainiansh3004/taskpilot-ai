document.addEventListener('DOMContentLoaded', () => {
  let currentInvoices = [];
  let selectedInvoice = null;

  // DOM elements
  const invoicesTableBody = document.getElementById('invoices-table-body');
  const recordsTableBody = document.getElementById('records-table-body');
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  const clearSearchBtn = document.getElementById('clear-search-btn');
  const resetDbBtn = document.getElementById('reset-db-btn');
  const refreshRecordsBtn = document.getElementById('refresh-records-btn');
  const createRecordForm = document.getElementById('create-record-form');
  const recordStatusAlert = document.getElementById('record-status-alert');

  // Form Inputs
  const inputInvoiceId = document.getElementById('record-invoice-id');
  const inputCompanyName = document.getElementById('record-company-name');
  const inputInvoiceNumber = document.getElementById('record-invoice-number');
  const inputAmount = document.getElementById('record-amount');
  const inputDueDate = document.getElementById('record-due-date');
  const inputNotes = document.getElementById('record-notes');
  const clearFormBtn = document.getElementById('clear-form-btn');

  // Modal elements
  const modal = document.getElementById('invoice-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalBodyContent = document.getElementById('modal-body-content');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalDismissBtn = document.getElementById('modal-dismiss-btn');
  const modalPrefillBtn = document.getElementById('modal-prefill-btn');

  // Stats
  const statTotal = document.getElementById('stat-total-invoices');
  const statPending = document.getElementById('stat-pending-invoices');
  const statEntered = document.getElementById('stat-entered-records');

  // Load Invoices
  async function loadInvoices(searchTerm = '') {
    try {
      const url = searchTerm ? `/api/invoices?search=${encodeURIComponent(searchTerm)}` : '/api/invoices';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        currentInvoices = data.invoices;
        renderInvoices(currentInvoices);
        updateStats();
      }
    } catch (err) {
      console.error('Failed to load invoices:', err);
    }
  }

  // Load Records
  async function loadRecords() {
    try {
      const res = await fetch('/api/records');
      const data = await res.json();
      if (data.success) {
        renderRecords(data.records);
        statEntered.textContent = data.records.length;
      }
    } catch (err) {
      console.error('Failed to load records:', err);
    }
  }

  function renderInvoices(invoices) {
    invoicesTableBody.innerHTML = '';
    if (invoices.length === 0) {
      invoicesTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px; color: var(--text-secondary);">No invoices found.</td></tr>';
      return;
    }

    invoices.forEach(inv => {
      const tr = document.createElement('tr');
      tr.setAttribute('data-invoice-id', inv.id);
      tr.setAttribute('data-testid', `invoice-row-${inv.id}`);

      const statusBadge = `<span class="badge badge-${inv.status}">${inv.status.toUpperCase()}</span>`;

      tr.innerHTML = `
        <td><code>${inv.id}</code></td>
        <td><strong>${escapeHtml(inv.companyName)}</strong></td>
        <td>${escapeHtml(inv.invoiceNumber)}</td>
        <td>${inv.issueDate}</td>
        <td>${inv.dueDate || '<span style="color:var(--accent-red)">Missing</span>'}</td>
        <td><strong>$${inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></td>
        <td>${statusBadge}</td>
        <td>
          <button class="btn btn-secondary btn-sm action-view" data-id="${inv.id}" data-testid="view-invoice-btn-${inv.id}">View</button>
          <button class="btn btn-primary btn-sm action-prefill" data-id="${inv.id}" data-testid="prefill-btn-${inv.id}">Prefill</button>
        </td>
      `;

      invoicesTableBody.appendChild(tr);
    });

    // Attach listeners
    document.querySelectorAll('.action-view').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        openInvoiceModal(id);
      });
    });

    document.querySelectorAll('.action-prefill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        prefillForm(id);
      });
    });
  }

  function renderRecords(records) {
    recordsTableBody.innerHTML = '';
    if (records.length === 0) {
      recordsTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px; color: var(--text-secondary);">No records recorded yet.</td></tr>';
      return;
    }

    records.forEach(rec => {
      const tr = document.createElement('tr');
      tr.setAttribute('data-record-id', rec.id);
      tr.setAttribute('data-testid', `record-row-${rec.id}`);

      tr.innerHTML = `
        <td><code>${rec.id}</code></td>
        <td><strong>${escapeHtml(rec.invoiceNumber)}</strong></td>
        <td>${escapeHtml(rec.companyName)}</td>
        <td>$${rec.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
        <td>${rec.dueDate}</td>
        <td><span class="badge badge-${rec.status}">${rec.status.toUpperCase()}</span></td>
      `;

      recordsTableBody.appendChild(tr);
    });
  }

  function updateStats() {
    statTotal.textContent = currentInvoices.length;
    const pending = currentInvoices.filter(i => i.status === 'pending').length;
    statPending.textContent = pending;
  }

  function prefillForm(invoiceId) {
    const inv = currentInvoices.find(i => i.id === invoiceId);
    if (!inv) return;

    inputInvoiceId.value = inv.id;
    inputCompanyName.value = inv.companyName;
    inputInvoiceNumber.value = inv.invoiceNumber;
    inputAmount.value = inv.amount;
    inputDueDate.value = inv.dueDate || '';
    inputNotes.value = `Entered from portal review of ${inv.invoiceNumber}`;

    recordStatusAlert.className = 'alert alert-success';
    recordStatusAlert.textContent = `Form prefilled with details from ${inv.invoiceNumber}.`;
    recordStatusAlert.classList.remove('d-none');
  }

  function openInvoiceModal(invoiceId) {
    const inv = currentInvoices.find(i => i.id === invoiceId);
    if (!inv) return;
    selectedInvoice = inv;

    modalTitle.textContent = `${inv.companyName} — ${inv.invoiceNumber}`;
    let itemsHtml = (inv.lineItems || []).map(li => `
      <tr>
        <td style="padding:6px 8px; border-bottom:1px solid var(--border-color);">${escapeHtml(li.description)}</td>
        <td style="padding:6px 8px; border-bottom:1px solid var(--border-color); text-align:right;">${li.quantity}</td>
        <td style="padding:6px 8px; border-bottom:1px solid var(--border-color); text-align:right;">$${li.unitPrice.toFixed(2)}</td>
        <td style="padding:6px 8px; border-bottom:1px solid var(--border-color); text-align:right;">$${li.total.toFixed(2)}</td>
      </tr>
    `).join('');

    modalBodyContent.innerHTML = `
      <div style="margin-bottom:14px;">
        <p><strong>Description:</strong> ${escapeHtml(inv.description)}</p>
        <p><strong>Issue Date:</strong> ${inv.issueDate} &nbsp;|&nbsp; <strong>Due Date:</strong> ${inv.dueDate || '<span style="color:var(--accent-red)">Missing</span>'}</p>
        <p><strong>Total Amount:</strong> $${inv.amount.toFixed(2)} ${inv.currency}</p>
        <p><strong>Current Status:</strong> <span class="badge badge-${inv.status}">${inv.status}</span></p>
      </div>
      <h4 style="margin-bottom:8px; font-size:0.9rem;">Line Items:</h4>
      <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
        <thead>
          <tr style="color:var(--text-secondary); text-align:left;">
            <th style="padding:6px 8px;">Item</th>
            <th style="padding:6px 8px; text-align:right;">Qty</th>
            <th style="padding:6px 8px; text-align:right;">Rate</th>
            <th style="padding:6px 8px; text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
    `;

    modal.classList.remove('d-none');
  }

  function closeModal() {
    modal.classList.add('d-none');
    selectedInvoice = null;
  }

  modalCloseBtn.addEventListener('click', closeModal);
  modalDismissBtn.addEventListener('click', closeModal);
  modalPrefillBtn.addEventListener('click', () => {
    if (selectedInvoice) {
      prefillForm(selectedInvoice.id);
      closeModal();
    }
  });

  // Create Record Submission
  createRecordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    recordStatusAlert.classList.add('d-none');

    const payload = {
      invoiceId: inputInvoiceId.value.trim(),
      companyName: inputCompanyName.value.trim(),
      invoiceNumber: inputInvoiceNumber.value.trim(),
      amount: parseFloat(inputAmount.value),
      dueDate: inputDueDate.value.trim(),
      notes: inputNotes.value.trim()
    };

    try {
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        recordStatusAlert.className = 'alert alert-success';
        recordStatusAlert.textContent = `Success: Invoice record ${data.record.invoiceNumber} recorded! Record ID: ${data.record.id}`;
        recordStatusAlert.classList.remove('d-none');
        createRecordForm.reset();
        loadRecords();
      } else {
        recordStatusAlert.className = 'alert alert-error';
        recordStatusAlert.textContent = `Error: ${data.message || data.error || 'Submission failed'}`;
        recordStatusAlert.classList.remove('d-none');
      }
    } catch (err) {
      recordStatusAlert.className = 'alert alert-error';
      recordStatusAlert.textContent = `Network / Portal Error: ${err.message}`;
      recordStatusAlert.classList.remove('d-none');
    }
  });

  // Clear Form
  clearFormBtn.addEventListener('click', () => {
    createRecordForm.reset();
    recordStatusAlert.classList.add('d-none');
  });

  // Search
  searchBtn.addEventListener('click', () => {
    loadInvoices(searchInput.value.trim());
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      loadInvoices(searchInput.value.trim());
    }
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    loadInvoices();
  });

  // Refresh
  refreshRecordsBtn.addEventListener('click', loadRecords);

  // Reset Database
  resetDbBtn.addEventListener('click', async () => {
    if (confirm('Reset portal database to initial seed data?')) {
      await fetch('/api/reset', { method: 'POST' });
      searchInput.value = '';
      loadInvoices();
      loadRecords();
    }
  });

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[m]);
  }

  // Initial load
  loadInvoices();
  loadRecords();
});
