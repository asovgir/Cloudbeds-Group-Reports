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
    html += `
      <div class="group-card">
        <div class="group-header" onclick="toggleGroup(${index})">
          <div><strong>${group.name} (${group.code})</strong></div>
          <div>${group.total_blocks} blocks • $${group.total_forecasted_revenue.toLocaleString()}</div>
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
        <td style="color: #38a169; font-weight: 600;">$${actualRevenue.toLocaleString()}</td>
        <td style="color: #38a169; font-weight: 600;">$${forecastedRevenue.toLocaleString()}</td>
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
  document.getElementById(`group-${index}`).classList.toggle('show');
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
}

function exportReport() {
  alert('Export functionality can be implemented.');
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

// FIXED: Enhanced loadReservations function
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

// Close modal when clicking outside
window.addEventListener('click', function(event) {
  const modal = document.getElementById('reservationsModal');
  if (event.target === modal) {
    modal.style.display = 'none';
  }
});