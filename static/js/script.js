// Initialize page
document.addEventListener('DOMContentLoaded', function() {
  // Set default dates
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
  document.getElementById('startDate').value = today.toISOString().split('T')[0];
  document.getElementById('endDate').value = nextMonth.toISOString().split('T')[0];
  
  // Initialize status text
  updateStatusText();
});

// Status dropdown functions
function toggleStatusDropdown() {
  document.getElementById('statusDropdown').classList.toggle('show');
}

function toggleSelectAll() {
  const selectAll = document.getElementById('selectAll');
  ['statusLead', 'statusTentative', 'statusDefinite', 'statusCancelled'].forEach(id => {
    document.getElementById(id).checked = selectAll.checked;
  });
  updateStatusText();
}

function updateStatusText() {
  const checkedStatuses = ['statusLead', 'statusTentative', 'statusDefinite', 'statusCancelled']
    .filter(id => document.getElementById(id).checked);
  const selectAll = document.getElementById('selectAll');
  selectAll.checked = checkedStatuses.length === 4;
  
  const statusText = document.getElementById('statusText');
  if (checkedStatuses.length === 0) statusText.textContent = 'None Selected';
  else if (checkedStatuses.length === 4) statusText.textContent = 'All Selected';
  else statusText.textContent = `${checkedStatuses.length} Selected`;
}

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
  if (!e.target.closest('.dropdown')) {
    document.getElementById('statusDropdown').classList.remove('show');
  }
});

// Store report data globally for export
let currentReportData = null;

// Main report generation
function generateReport() {
  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;
  
  if (!startDate || !endDate) {
    showError('Please select both start and end dates.');
    return;
  }
  
  showLoading();
  hideError();
  
  fetch(`/api/group-allotment-report?start_date=${startDate}&end_date=${endDate}`)
    .then(response => response.json())
    .then(data => {
      hideLoading();
      if (data.success) {
        currentReportData = data.data; // Store for export
        displayReport(data.data);
      } else {
        showError('Error: ' + data.error);
      }
    })
    .catch(error => {
      hideLoading();
      showError('Network error: ' + error.message);
    });
}

function displayReport(data) {
  displaySummary(data);
  displayGroups(data.groups);
  document.getElementById('exportBtn').style.display = 'flex';
}

function displaySummary(data) {
  document.getElementById('totalGroups').textContent = data.summary.total_groups;
  document.getElementById('totalBlocks').textContent = data.summary.total_allotment_blocks;
  document.getElementById('totalRevenue').textContent = '$' + data.summary.total_forecasted_revenue.toLocaleString();
  document.getElementById('dateRange').textContent = `${data.date_range.start_date} to ${data.date_range.end_date}`;
  document.getElementById('summary').classList.add('show');
}

function displayGroups(groups) {
  const container = document.getElementById('results');
  
  if (!groups || groups.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 40px; color: #718096;">No data found.</div>';
    return;
  }
  
  let html = '';
  groups.forEach((group, index) => {
    const displayName = group.display_name || `${group.name} (${group.code})`;
    html += `
      <div class="group-card">
        <div class="group-header" onclick="toggleGroup(${index})">
          <div><strong>${displayName}</strong></div>
          <div>${group.total_blocks} blocks • ${group.total_forecasted_revenue.toLocaleString()}</div>
        </div>
        <div class="group-content" id="group-${index}">
          ${generateBlockSummary(group.allotment_blocks)}
          ${generateBlockDetails(group.allotment_blocks)}
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

function generateBlockSummary(blocks) {
  let html = `
    <h4><i class="fas fa-list"></i> Block Summary</h4>
    <table class="table">
      <thead>
        <tr>
          <th>Block Name</th>
          <th>Code</th>
          <th>Status</th>
          <th>Start Date</th>
          <th>End Date</th>
          <th>Pickup</th>
          <th>Revenue</th>
          <th>Forecasted Revenue</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  blocks.forEach(block => {
    const dates = block.dates_data.map(d => d.date).sort();
    const startDate = dates[0] || '-';
    const endDate = dates[dates.length - 1] || '-';
    
    let totalConfirmed = 0, totalAllotted = 0, actualRevenue = 0, forecastedRevenue = 0;
    block.dates_data.forEach(date => {
      date.room_types.forEach(room => {
        totalConfirmed += room.block_confirmed || 0;
        totalAllotted += room.block_allotted || 0;
        actualRevenue += (room.block_confirmed || 0) * (room.rate || 0);
        forecastedRevenue += (room.block_allotted || 0) * (room.rate || 0);
      });
    });
    const pickup = totalAllotted > 0 ? Math.round((totalConfirmed / totalAllotted) * 100) : 0;
    
    html += `
      <tr>
        <td><strong>${block.name}</strong></td>
        <td>${block.code || '-'}</td>
        <td>${block.status || '-'}</td>
        <td>${startDate}</td>
        <td>${endDate}</td>
        <td>
          <div class="pickup-bar">
            <div class="pickup-fill" style="width: ${pickup}%"></div>
            <div class="pickup-text">${pickup}%</div>
          </div>
          <div style="font-size: 11px; text-align: center; margin-top: 2px;">${totalConfirmed}/${totalAllotted}</div>
        </td>
        <td style="color: #38a169; font-weight: 600;">${actualRevenue.toLocaleString()}</td>
        <td style="color: #38a169; font-weight: 600;">${forecastedRevenue.toLocaleString()}</td>
      </tr>
    `;
  });
  
  html += '</tbody></table>';
  return html;
}

function generateBlockDetails(blocks) {
  let html = '<h4 style="margin-top: 30px;"><i class="fas fa-calendar-alt"></i> Detailed Room Type Breakdown</h4>';
  
  blocks.forEach(block => {
    if (!block.dates_data || block.dates_data.length === 0) return;
    
    html += `
      <div class="detail-card">
        <div class="detail-header">
          <i class="fas fa-building"></i> 
          <span style="cursor: pointer; color: #4299e1; text-decoration: underline;" onclick="loadReservations('${block.code}', '${block.name}')">
            ${block.name} (${block.code || 'No Code'})
          </span>
          <small style="margin-left: 10px; color: #718096; font-weight: normal;">
            <i class="fas fa-bed"></i> Click to view reservations
          </small>
        </div>
        <table class="detail-table">
          <thead>
            <tr>
              <th style="padding: 8px; border: 1px solid #cbd5e0;">Date</th>
              <th style="padding: 8px; border: 1px solid #cbd5e0;">Room Type</th>
              <th style="padding: 8px; border: 1px solid #cbd5e0; text-align: right;">Rate</th>
              <th style="padding: 8px; border: 1px solid #cbd5e0; text-align: center;">Allotted</th>
              <th style="padding: 8px; border: 1px solid #cbd5e0; text-align: center;">Confirmed</th>
              <th style="padding: 8px; border: 1px solid #cbd5e0; text-align: center;">Remaining</th>
              <th style="padding: 8px; border: 1px solid #cbd5e0; text-align: center;">Pickup %</th>
              <th style="padding: 8px; border: 1px solid #cbd5e0; text-align: right;">Revenue</th>
              <th style="padding: 8px; border: 1px solid #cbd5e0; text-align: right;">Forecasted Revenue</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    block.dates_data.forEach(dateInfo => {
      dateInfo.room_types.forEach(room => {
        const actualRevenue = (room.block_confirmed || 0) * (room.rate || 0);
        const forecastedRevenue = (room.block_allotted || 0) * (room.rate || 0);
        html += `
          <tr>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: 500;">${dateInfo.date}</td>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${room.room_type_id}</td>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: right;">${(room.rate || 0).toFixed(2)}</td>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center; font-weight: 600;">${room.block_allotted || 0}</td>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center; font-weight: 600; color: #38a169;">${room.block_confirmed || 0}</td>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center; font-weight: 600; color: #e53e3e;">${room.block_remaining || 0}</td>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center;">${room.pickup_percentage || 0}%</td>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: right; color: #38a169; font-weight: 600;">${actualRevenue.toFixed(2)}</td>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: right; color: #38a169; font-weight: 600;">${forecastedRevenue.toFixed(2)}</td>
          </tr>
        `;
      });
    });
    
    html += `
          </tbody>
        </table>
      </div>
    `;
  });
  
  return html;
}

function toggleGroup(index) {
  const content = document.getElementById(`group-${index}`);
  const chevron = document.querySelector(`[onclick="toggleGroup(${index})"] .fa-chevron-down`);
  
  content.classList.toggle('show');
  
  // Rotate chevron icon
  if (content.classList.contains('show')) {
    chevron.style.transform = 'rotate(180deg)';
  } else {
    chevron.style.transform = 'rotate(0deg)';
  }
}

function clearReport() {
  document.getElementById('results').innerHTML = '';
  document.getElementById('summary').classList.remove('show');
  document.getElementById('exportBtn').style.display = 'none';
  document.getElementById('groupFilter').value = '';
  document.getElementById('blockFilter').value = '';
  ['statusLead', 'statusTentative', 'statusDefinite'].forEach(id => {
    document.getElementById(id).checked = true;
  });
  document.getElementById('statusCancelled').checked = false;
  updateStatusText();
  currentReportData = null; // Clear stored data
}

// ENHANCED: Export functionality with reservations
function exportReport() {
  if (!currentReportData) {
    showError('No report data available for export. Please generate a report first.');
    return;
  }
  
  // Show export options modal
  showExportModal();
}

function showExportModal() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'exportModal';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 500px;">
      <div class="modal-header">
        <h3><i class="fas fa-download"></i> Export Report</h3>
        <span class="close" onclick="closeExportModal()">&times;</span>
      </div>
      <div class="modal-body">
        <div style="margin-bottom: 20px;">
          <h4>Choose Export Format:</h4>
          <div style="display: grid; gap: 10px; margin-top: 15px;">
            <button class="btn btn-primary" onclick="exportToCSV()" style="width: 100%; justify-content: center;">
              <i class="fas fa-file-csv"></i> Export to CSV
            </button>
            <button class="btn btn-secondary" onclick="exportToJSON()" style="width: 100%; justify-content: center;">
              <i class="fas fa-file-code"></i> Export to JSON
            </button>
            <button class="btn btn-success" onclick="exportToPDF()" style="width: 100%; justify-content: center;">
              <i class="fas fa-file-pdf"></i> Export to PDF (Print)
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  modal.style.display = 'block';
}

function closeExportModal() {
  const modal = document.getElementById('exportModal');
  if (modal) {
    modal.remove();
  }
}

function exportToCSV() {
  if (!currentReportData) return;
  
  showError('📊 Preparing comprehensive export with reservations... This may take a moment.');
  
  // We'll export multiple sheets worth of data in one CSV
  const sections = [];
  
  // 1. Summary Section
  sections.push('=== REPORT SUMMARY ===');
  sections.push(`Date Range,${currentReportData.date_range.start_date},${currentReportData.date_range.end_date}`);
  sections.push(`Total Groups,${currentReportData.summary.total_groups}`);
  sections.push(`Total Allotment Blocks,${currentReportData.summary.total_allotment_blocks}`);
  sections.push(`Total Forecasted Revenue,${currentReportData.summary.total_forecasted_revenue.toLocaleString()}`);
  sections.push('');
  
  // 2. Groups Overview
  sections.push('=== GROUPS OVERVIEW ===');
  sections.push('Group Name,Group Code,Total Blocks,Total Forecasted Revenue');
  currentReportData.groups.forEach(group => {
    sections.push(`"${group.name}","${group.code}",${group.total_blocks},${group.total_forecasted_revenue.toLocaleString()}`);
  });
  sections.push('');
  
  // 3. Detailed Allotment Data
  sections.push('=== ALLOTMENT BLOCKS DETAIL ===');
  sections.push('Group Name,Group Code,Block Name,Block Code,Block Status,Date,Room Type,Rate,Allotted,Confirmed,Remaining,Pickup %,Actual Revenue,Forecasted Revenue');
  
  currentReportData.groups.forEach(group => {
    group.allotment_blocks.forEach(block => {
      block.dates_data.forEach(dateInfo => {
        dateInfo.room_types.forEach(room => {
          const actualRevenue = (room.block_confirmed || 0) * (room.rate || 0);
          const forecastedRevenue = (room.block_allotted || 0) * (room.rate || 0);
          const displayName = group.display_name || `${group.name} (${group.code})`;
          
          sections.push([
            `"${displayName}"`,
            `"${group.code}"`,
            `"${block.name}"`,
            `"${block.code || ''}"`,
            `"${block.status || ''}"`,
            dateInfo.date,
            `"${room.room_type_id}"`,
            room.rate || 0,
            room.block_allotted || 0,
            room.block_confirmed || 0,
            room.block_remaining || 0,
            room.pickup_percentage || 0,
            actualRevenue.toFixed(2),
            forecastedRevenue.toFixed(2)
          ].join(','));
        });
      });
    });
  });
  
  // 4. Fetch and include reservations for each block
  fetchAllReservationsForExport(currentReportData.groups)
    .then(reservationsData => {
      if (reservationsData && reservationsData.length > 0) {
        sections.push('');
        sections.push('=== RESERVATIONS DETAIL ===');
        sections.push('Group Name,Group Code,Block Name,Block Code,Reservation ID,Guest Name,Check-in,Check-out,Nights,Adults,Children,Room Type,Room Number,Status,Total Amount');
        
        reservationsData.forEach(resData => {
          resData.reservations.forEach(reservation => {
            const checkInDate = getDateValue(reservation.startDate);
            const checkOutDate = getDateValue(reservation.endDate);
            const nights = calculateNights(checkInDate, checkOutDate);
            const guestName = getGuestName(reservation);
            const roomType = getRoomType(reservation);
            const roomNumber = getRoomNumber(reservation);
            const totalAmount = reservation.total || reservation.balance || 0;
            
            sections.push([
              `"${resData.groupName}"`,
              `"${resData.groupCode}"`,
              `"${resData.blockName}"`,
              `"${resData.blockCode}"`,
              `"${reservation.reservationID || ''}"`,
              `"${guestName}"`,
              formatDate(checkInDate),
              formatDate(checkOutDate),
              nights,
              reservation.adults || 0,
              reservation.children || 0,
              `"${roomType}"`,
              `"${roomNumber}"`,
              `"${reservation.status || ''}"`,
              totalAmount
            ].join(','));
          });
        });
      }
      
      // Download the complete CSV
      const csvContent = sections.join('\n');
      downloadFile(csvContent, 'cloudbeds-complete-allotment-report.csv', 'text/csv');
      hideError();
      closeExportModal();
    })
    .catch(error => {
      console.error('Error fetching reservations for export:', error);
      // Still export without reservations
      const csvContent = sections.join('\n');
      downloadFile(csvContent, 'cloudbeds-allotment-report-basic.csv', 'text/csv');
      showError('Export completed, but reservations data could not be included due to: ' + error.message);
      closeExportModal();
    });
}

function exportToJSON() {
  if (!currentReportData) return;
  
  const jsonContent = JSON.stringify(currentReportData, null, 2);
  downloadFile(jsonContent, 'cloudbeds-allotment-report.json', 'application/json');
  closeExportModal();
}

function exportToPDF() {
  closeExportModal();
  
  // Create a print-friendly version
  const printWindow = window.open('', '_blank');
  const reportHtml = generatePrintableReport();
  
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Cloudbeds Allotment Report</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        .summary { background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .group-header { background: #2d3748; color: white; padding: 10px; font-weight: bold; }
        .currency { color: #38a169; font-weight: bold; }
        @media print {
          body { margin: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      ${reportHtml}
      <div class="no-print" style="margin-top: 20px; text-align: center;">
        <button onclick="window.print()" style="padding: 10px 20px; background: #4299e1; color: white; border: none; border-radius: 5px; cursor: pointer;">Print Report</button>
        <button onclick="window.close()" style="padding: 10px 20px; background: #718096; color: white; border: none; border-radius: 5px; cursor: pointer; margin-left: 10px;">Close</button>
      </div>
    </body>
    </html>
  `);
  
  printWindow.document.close();
}

function generatePrintableReport() {
  if (!currentReportData) return '';
  
  let html = `
    <h1>Cloudbeds Allotment Report</h1>
    <div class="summary">
      <h3>Summary</h3>
      <p><strong>Date Range:</strong> ${currentReportData.date_range.start_date} to ${currentReportData.date_range.end_date}</p>
      <p><strong>Total Groups:</strong> ${currentReportData.summary.total_groups}</p>
      <p><strong>Total Blocks:</strong> ${currentReportData.summary.total_allotment_blocks}</p>
      <p><strong>Total Forecasted Revenue:</strong> <span class="currency">$${currentReportData.summary.total_forecasted_revenue.toLocaleString()}</span></p>
    </div>
  `;
  
  currentReportData.groups.forEach(group => {
    html += `
      <div class="group-header">
        ${group.name} (${group.code}) - ${group.total_blocks} blocks • $${group.total_forecasted_revenue.toLocaleString()}
      </div>
      <table>
        <thead>
          <tr>
            <th>Block</th>
            <th>Date</th>
            <th>Room Type</th>
            <th>Rate</th>
            <th>Allotted</th>
            <th>Confirmed</th>
            <th>Pickup %</th>
            <th>Revenue</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    group.allotment_blocks.forEach(block => {
      block.dates_data.forEach(dateInfo => {
        dateInfo.room_types.forEach(room => {
          const actualRevenue = (room.block_confirmed || 0) * (room.rate || 0);
          html += `
            <tr>
              <td>${block.name}</td>
              <td>${dateInfo.date}</td>
              <td>${room.room_type_id}</td>
              <td>$${(room.rate || 0).toFixed(2)}</td>
              <td>${room.block_allotted || 0}</td>
              <td>${room.block_confirmed || 0}</td>
              <td>${room.pickup_percentage || 0}%</td>
              <td class="currency">$${actualRevenue.toFixed(2)}</td>
            </tr>
          `;
        });
      });
    });
    
    html += '</tbody></table>';
  });
  
  return html;
}

// NEW: Function to fetch all reservations for export
async function fetchAllReservationsForExport(groups) {
  const allReservations = [];
  
  for (const group of groups) {
    for (const block of group.allotment_blocks) {
      if (block.code) {
        try {
          const response = await fetch(`/api/reservations?allotmentBlockCode=${encodeURIComponent(block.code)}`);
          const data = await response.json();
          
          if (data.success && data.data && data.data.length > 0) {
            allReservations.push({
              groupName: group.name,
              groupCode: group.code,
              blockName: block.name,
              blockCode: block.code,
              reservations: data.data
            });
          }
        } catch (error) {
          console.error(`Error fetching reservations for block ${block.code}:`, error);
        }
      }
    }
  }
  
  return allReservations;
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
function loadReservations(blockCode, blockName) {
  console.log('Loading reservations for block:', blockCode, blockName);
  
  // Show modal with loading state
  document.getElementById('modalTitle').innerHTML = `<i class="fas fa-bed"></i> Reservations for ${blockName}`;
  document.getElementById('modalBody').innerHTML = '<div style="text-align: center; padding: 50px;"><i class="fas fa-spinner fa-spin"></i> Loading reservations...</div>';
  document.getElementById('reservationsModal').style.display = 'block';
  
  // FIXED: Use the correct endpoint with allotmentBlockCode parameter
  fetch(`/api/reservations?allotmentBlockCode=${encodeURIComponent(blockCode)}`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      console.log('Reservations API response:', data);
      
      if (data.success && data.data && data.data.length > 0) {
        document.getElementById('modalBody').innerHTML = generateReservationsTable(data.data, blockName, blockCode);
      } else {
        document.getElementById('modalBody').innerHTML = `
          <div style="text-align: center; padding: 50px; color: #718096;">
            <i class="fas fa-info-circle" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i><br>
            <h4>No reservations found</h4>
            <p>No reservations found for allotment block: <strong>${blockName}</strong> (${blockCode})</p>
            <small style="color: #a0aec0;">This could mean no reservations have been made or they are not linked to this block code.</small>
          </div>
        `;
      }
    })
    .catch(error => {
      console.error('Error loading reservations:', error);
      document.getElementById('modalBody').innerHTML = `
        <div style="text-align: center; padding: 50px; color: #e53e3e;">
          <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 16px;"></i><br>
          <h4>Error Loading Reservations</h4>
          <p><strong>Error:</strong> ${error.message}</p>
          <small style="color: #a0aec0;">Please check the network connection and try again.</small>
        </div>
      `;
    });
}

function closeReservationsModal() {
  document.getElementById('reservationsModal').style.display = 'none';
}

// FIXED: Enhanced generateReservationsTable function with better field mapping
function generateReservationsTable(reservations, blockName, blockCode) {
  console.log('Generating table for reservations:', reservations);
  
  let html = `
    <div style="margin-bottom: 20px;">
      <h4 style="color: #1976d2; margin-bottom: 8px;">
        <i class="fas fa-list"></i> ${reservations.length} Reservation${reservations.length !== 1 ? 's' : ''} for ${blockName}
      </h4>
      <p style="color: #718096; font-size: 14px; margin: 0;">
        <strong>Block Code:</strong> ${blockCode}
      </p>
    </div>
    <div style="overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd; min-width: 1000px;">
        <thead>
          <tr style="background: #f8f9fa;">
            <th style="padding: 12px; border: 1px solid #ddd; text-align: left; font-weight: 600;">Reservation ID</th>
            <th style="padding: 12px; border: 1px solid #ddd; text-align: left; font-weight: 600;">Guest Name</th>
            <th style="padding: 12px; border: 1px solid #ddd; text-align: center; font-weight: 600;">Check-in</th>
            <th style="padding: 12px; border: 1px solid #ddd; text-align: center; font-weight: 600;">Check-out</th>
            <th style="padding: 12px; border: 1px solid #ddd; text-align: center; font-weight: 600;">Nights</th>
            <th style="padding: 12px; border: 1px solid #ddd; text-align: center; font-weight: 600;">Adults</th>
            <th style="padding: 12px; border: 1px solid #ddd; text-align: center; font-weight: 600;">Children</th>
            <th style="padding: 12px; border: 1px solid #ddd; text-align: left; font-weight: 600;">Room Type</th>
            <th style="padding: 12px; border: 1px solid #ddd; text-align: center; font-weight: 600;">Room Number</th>
            <th style="padding: 12px; border: 1px solid #ddd; text-align: center; font-weight: 600;">Status</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  reservations.forEach(reservation => {
    // FIXED: Use CloudBeds API field names
    const checkInDate = getDateValue(reservation.startDate);  // CloudBeds uses 'startDate'
    const checkOutDate = getDateValue(reservation.endDate);   // CloudBeds uses 'endDate'
    const nights = calculateNights(checkInDate, checkOutDate);
    
    // FIXED: Get guest name (CloudBeds uses 'guestName')
    const guestName = getGuestName(reservation);
    
    // FIXED: Get room information from assigned/unassigned arrays
    const roomType = getRoomType(reservation);
    const roomNumber = getRoomNumber(reservation);
    
    // Get other reservation details (CloudBeds field names)
    const adults = reservation.adults || '-';
    const children = reservation.children || '0';
    const status = reservation.status || 'Unknown';
    const reservationId = reservation.reservationID || '-';  // CloudBeds uses 'reservationID'
    
    html += `
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd; font-weight: 500;">${reservationId}</td>
        <td style="padding: 10px; border: 1px solid #ddd; font-weight: 500;">${guestName}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${formatDate(checkInDate)}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${formatDate(checkOutDate)}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: 600;">${nights}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${adults}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${children}</td>
        <td style="padding: 10px; border: 1px solid #ddd;">${roomType}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: 600;">${roomNumber}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">
          <span style="padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; color: white; background: ${getStatusColor(status)};">
            ${status}
          </span>
        </td>
      </tr>
    `;
  });
  
  html += '</tbody></table></div>';
  return html;
}

// Helper functions for reservation data extraction (FIXED for CloudBeds API)
function getDateValue(dateField) {
  if (!dateField) return null;
  return new Date(dateField);
}

function calculateNights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return '-';
  const timeDiff = checkOut.getTime() - checkIn.getTime();
  const nights = Math.ceil(timeDiff / (1000 * 3600 * 24));
  return nights > 0 ? nights : '-';
}

function getGuestName(reservation) {
  // CloudBeds uses 'guestName' field
  return reservation.guestName || 'Guest Name Not Available';
}

function getRoomType(reservation) {
  // Check assigned and unassigned arrays for room type information
  if (reservation.assigned && reservation.assigned.length > 0) {
    const assignedRoom = reservation.assigned[0];
    return assignedRoom.roomTypeName || assignedRoom.roomType || assignedRoom.subRoomName || '-';
  }
  
  if (reservation.unassigned && reservation.unassigned.length > 0) {
    const unassignedRoom = reservation.unassigned[0];
    return unassignedRoom.roomTypeName || unassignedRoom.roomType || unassignedRoom.subRoomName || '-';
  }
  
  return '-';
}

function getRoomNumber(reservation) {
  // Check assigned array for room number
  if (reservation.assigned && reservation.assigned.length > 0) {
    const assignedRoom = reservation.assigned[0];
    return assignedRoom.roomName || assignedRoom.roomNumber || assignedRoom.room || '-';
  }
  
  // If no assigned room, return unassigned
  return 'Unassigned';
}

function getStatusColor(status) {
  const statusLower = status.toLowerCase();
  if (statusLower.includes('confirm')) return '#48bb78';
  if (statusLower.includes('checkedin') || statusLower.includes('arrived')) return '#4299e1';
  if (statusLower.includes('cancelled')) return '#f56565';
  if (statusLower.includes('pending')) return '#ed8936';
  if (statusLower.includes('checkout') || statusLower.includes('departed')) return '#9f7aea';
  return '#718096'; // default gray
}

function formatDate(dateObj) {
  if (!dateObj || !(dateObj instanceof Date) || isNaN(dateObj)) return '-';
  try {
    return dateObj.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
  } catch (e) {
    return '-';
  }
}

// Utility functions
function showLoading() {
  document.getElementById('loading').style.display = 'block';
}

function hideLoading() {
  document.getElementById('loading').style.display = 'none';
}

function showError(message) {
  const errorDiv = document.getElementById('error');
  errorDiv.textContent = message;
  errorDiv.classList.add('show');
}

function hideError() {
  document.getElementById('error').classList.remove('show');
}

// Close modal when clicking outside
window.addEventListener('click', function(event) {
  const modal = document.getElementById('reservationsModal');
  if (event.target === modal) {
    modal.style.display = 'none';
  }
  
  const exportModal = document.getElementById('exportModal');
  if (event.target === exportModal) {
    closeExportModal();
  }
});