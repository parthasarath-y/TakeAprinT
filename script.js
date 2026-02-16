// script.js — FIXED: Modal stays open, no auto-close
// Properly handles server responses and errors

// Initialize PDF.js worker
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
} else {
  console.error('PDF.js library not loaded');
}

const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const preview = document.getElementById('preview');
const queueList = document.getElementById('queueList');
const payBtn = document.getElementById('payBtn');
const dropZone = document.getElementById('dropZone');

let uploadedFilesData = [];

// Event listeners
uploadBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => handleFiles(fileInput.files));

// Drag and drop
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
  dropZone.addEventListener(evt, e => e.preventDefault(), false);
});

['dragenter', 'dragover'].forEach(evt => {
  dropZone.addEventListener(evt, () => dropZone.classList.add('dragover'));
});

['dragleave', 'drop'].forEach(evt => {
  dropZone.addEventListener(evt, () => dropZone.classList.remove('dragover'));
});

dropZone.addEventListener('drop', e => handleFiles(e.dataTransfer.files));

// Page counter
async function getPageCount(file) {
  const name = file.name.toLowerCase();
  const ext = name.split('.').pop();

  try {
    if (ext === 'pdf') {
      if (typeof pdfjsLib === 'undefined') {
        console.error('PDF.js not available');
        return 1;
      }
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument(arrayBuffer);
      const pdf = await loadingTask.promise;
      return pdf.numPages;
    }

    else if (ext === 'docx' || ext === 'doc') {
      if (typeof JSZip === 'undefined') {
        console.error('JSZip not available');
        return 1;
      }
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      
      if (!zip.file('word/document.xml')) {
        return 1;
      }
      
      const xml = await zip.file('word/document.xml').async('string');
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'application/xml');
      
      const pageBreaks = Array.from(
        doc.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'br')
      ).filter(br => {
        const typeAttr = br.getAttributeNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'type');
        return typeAttr === 'page';
      }).length;
      
      if (pageBreaks > 0) {
        return pageBreaks + 1;
      }
      
      const paras = doc.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'p').length;
      return Math.max(1, Math.ceil(paras / 35));
    }

    else if (ext === 'pptx' || ext === 'ppt') {
      if (typeof JSZip === 'undefined') {
        console.error('JSZip not available');
        return 1;
      }
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      let count = 0;
      for (let filename in zip.files) {
        if (filename.startsWith('ppt/slides/slide') && filename.endsWith('.xml')) {
          count++;
        }
      }
      return count || 1;
    }

    else if (ext === 'xlsx' || ext === 'xls') {
      if (typeof XLSX === 'undefined') {
        console.error('XLSX library not available');
        return 1;
      }
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      return workbook.SheetNames.length || 1;
    }

    else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) {
      return 1;
    }

    else {
      console.warn(`Unknown file type: ${ext}`);
      return 1;
    }
  } catch (err) {
    console.error(`Page count failed for ${name}:`, err);
    return 1;
  }
}

async function handleFiles(files) {
  if (!files?.length) return;
  if (preview.querySelector('.empty')) preview.innerHTML = '';

  for (const file of Array.from(files)) {
    const fileId = Date.now() + Math.random();
    const pageCount = await getPageCount(file);

    console.log(`📄 ${file.name} - ${pageCount} pages detected`);

    const fileData = { id: fileId, file, name: file.name, pageCount };
    uploadedFilesData.push(fileData);

    const queueItem = document.createElement('div');
    queueItem.className = 'queue-file-item';
    queueItem.dataset.fileId = fileId;
    queueItem.innerHTML = `
      <div class="queue-file-header">
        <div class="queue-file-name">${escapeHtml(file.name)}</div>
        <div class="copies-control">
          <button type="button" class="decr-btn"><i class="fa-solid fa-minus"></i></button>
          <span class="copies-count">1</span>
          <button type="button" class="incr-btn"><i class="fa-solid fa-plus"></i></button>
        </div>
        <button type="button" class="delete-file-btn" title="Remove"><i class="fa-solid fa-trash"></i></button>
      </div>
      <label>Print Type:
        <select class="print-type-select">
          <option value="bw" selected>Black & White</option>
          <option value="color">Color</option>
        </select>
      </label>
      <div class="queue-page-range hidden">
        <label>From: <input type="number" class="from-input" min="1" value="1" max="${pageCount}"></label>
        <label>To: <input type="number" class="to-input" min="1" value="${pageCount}" max="${pageCount}"></label>
        <div class="page-info" style="margin-top:0.5rem; font-size:0.85rem; color:#64748b;">
          <div class="color-info">Color: <span class="color-count">${pageCount}</span> pages</div>
          <div class="bw-info">B&W: <span class="bw-count">0</span> pages</div>
        </div>
      </div>
    `;
    queueList.insertBefore(queueItem, queueList.firstChild);

    const fileDiv = document.createElement('div');
    fileDiv.className = 'file-box';
    fileDiv.dataset.fileId = fileId;
    fileDiv.innerHTML = `
      <p><strong>${escapeHtml(file.name)}</strong></p>
      <p style="color:#64748b; font-size:0.9rem;">
        ${pageCount} page${pageCount > 1 ? 's' : ''}
      </p>
    `;
    preview.insertBefore(fileDiv, preview.firstChild);

    fileData.queueElement = queueItem;
    fileData.previewElement = fileDiv;

    const copiesCount = queueItem.querySelector('.copies-count');
    queueItem.querySelector('.incr-btn').addEventListener('click', () => {
      copiesCount.textContent = parseInt(copiesCount.textContent) + 1;
    });
    queueItem.querySelector('.decr-btn').addEventListener('click', () => {
      const current = parseInt(copiesCount.textContent);
      if (current > 1) {
        copiesCount.textContent = current - 1;
      }
    });

    const select = queueItem.querySelector('.print-type-select');
    const rangeDiv = queueItem.querySelector('.queue-page-range');
    const fromIn = queueItem.querySelector('.from-input');
    const toIn = queueItem.querySelector('.to-input');
    const colorCountSpan = queueItem.querySelector('.color-count');
    const bwCountSpan = queueItem.querySelector('.bw-count');

    function updatePageCounts() {
      const from = parseInt(fromIn.value) || 1;
      const to = parseInt(toIn.value) || pageCount;
      
      const colorPages = to - from + 1;
      const bwPages = (from - 1) + (pageCount - to);
      
      colorCountSpan.textContent = colorPages;
      bwCountSpan.textContent = bwPages;
    }

    select.addEventListener('change', () => {
      const showRange = select.value === 'color';
      rangeDiv.classList.toggle('hidden', !showRange);

      if (showRange) {
        fromIn.value = 1;
        toIn.value = pageCount;
        fromIn.max = pageCount;
        toIn.max = pageCount;
        fromIn.disabled = false;
        toIn.disabled = false;
        fromIn.removeAttribute('readonly');
        toIn.removeAttribute('readonly');
        
        updatePageCounts();
      }
    });

    function validateRange() {
      let from = parseInt(fromIn.value);
      let to = parseInt(toIn.value);

      if (isNaN(from) || from < 1) {
        from = 1;
      }
      if (isNaN(to) || to < 1) {
        to = pageCount;
      }

      from = Math.max(1, Math.min(from, pageCount));
      to = Math.max(1, Math.min(to, pageCount));

      if (from > to) {
        if (document.activeElement === fromIn) {
          from = to;
        } else {
          to = from;
        }
      }

      fromIn.value = from;
      toIn.value = to;
      
      updatePageCounts();
    }

    fromIn.addEventListener('change', validateRange);
    toIn.addEventListener('change', validateRange);
    fromIn.addEventListener('blur', validateRange);
    toIn.addEventListener('blur', validateRange);
    fromIn.addEventListener('keyup', () => {
      if (fromIn.value !== '') {
        updatePageCounts();
      }
    });
    toIn.addEventListener('keyup', () => {
      if (toIn.value !== '') {
        updatePageCounts();
      }
    });

    queueItem.querySelector('.delete-file-btn').addEventListener('click', () => {
      uploadedFilesData = uploadedFilesData.filter(f => f.id !== fileId);
      queueItem.style.opacity = '0';
      fileDiv.style.opacity = '0';
      setTimeout(() => {
        queueItem.remove();
        fileDiv.remove();
        if (uploadedFilesData.length === 0) {
          preview.innerHTML = '<p class="empty">No files uploaded yet...</p>';
        }
        updatePayButton();
      }, 300);
    });
  }

  updatePayButton();
  fileInput.value = '';
}

function updatePayButton() {
  payBtn.disabled = uploadedFilesData.length === 0;
}

// FIXED: Calculate prices locally (no server needed for display)
function calculateLocalPrices() {
  const COLOR_PRICE = 10.5;
  const BW_PRICE = 1.5;
  
  const filesData = [];
  let grandTotal = 0;

  uploadedFilesData.forEach((fileData) => {
    const queueItem = fileData.queueElement;
    const copies = parseInt(queueItem.querySelector('.copies-count').textContent);
    const printType = queueItem.querySelector('.print-type-select').value;
    
    let colorPages = 0;
    let bwPages = fileData.pageCount;
    
    if (printType === 'color') {
      const fromVal = parseInt(queueItem.querySelector('.from-input').value);
      const toVal = parseInt(queueItem.querySelector('.to-input').value);
      
      colorPages = toVal - fromVal + 1;
      bwPages = (fromVal - 1) + (fileData.pageCount - toVal);
    }

    const colorPrice = (colorPages * copies ) * COLOR_PRICE;
    const bwPrice = (bwPages * copies) * BW_PRICE;
    const fileTotal = colorPrice + bwPrice;
    
    grandTotal += fileTotal;

    filesData.push({
      original_name: fileData.name,
      pageCount: fileData.pageCount,
      colorPages: colorPages,
      bwPages: bwPages,
      copies: copies,
      printType: printType,
      fileTotal: fileTotal.toFixed(2)
    });
  });

  return {
    success: true,
    files: filesData,
    grandTotal: grandTotal.toFixed(2)
  };
}

// Create confirmation modal
function createConfirmationModal(data) {
  // Remove any existing modal first
  const existingModal = document.getElementById('confirmationModal');
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement('div');
  modal.id = 'confirmationModal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    animation: fadeIn 0.2s ease;
  `;

  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: white;
    padding: 2rem;
    border-radius: 16px;
    max-width: 500px;
    width: 90%;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    animation: slideIn 0.3s ease;
  `;

  let detailsHTML = '';
  data.files.forEach(file => {
    detailsHTML += `
      <div style="padding: 1rem; background: #f8fafc; margin-bottom: 0.8rem; border-radius: 8px; border-left: 4px solid #667eea;">
        <div style="font-weight: 600; color: #1a1d3a; margin-bottom: 0.5rem;"> ${escapeHtml(file.original_name)}</div>
        <div style="font-size: 0.9rem; color: #64748b;">
          ${file.printType === 'color' ? 
            `Color: ${file.colorPages} pages | B&W: ${file.bwPages} pages` : 
            `B&W: ${file.bwPages} pages`
          }
        </div>
        <div style="font-size: 0.9rem; color: #64748b;">Copies: ${file.copies}</div>
        <div style="font-weight: 600; color: #667eea; margin-top: 0.3rem;">₹${file.fileTotal}</div>
      </div>
    `;
  });

  modalContent.innerHTML = `
    <style>
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideIn {
        from { transform: translateY(-20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    </style>
    <h2 style="margin: 0 0 1.5rem 0; color: #1a1d3a; font-size: 1.5rem;">Order Summary</h2>
    <div style="max-height: 300px; overflow-y: auto; margin-bottom: 1.5rem;">
      ${detailsHTML}
    </div>
    <div style="padding: 1.5rem; background: #667eea; color: white; border-radius: 12px; margin-bottom: 1.5rem; text-align: center;">
      <div style="font-size: 0.9rem; opacity: 0.9; margin-bottom: 0.3rem;">Grand Total</div>
      <div style="font-size: 2rem; font-weight: 700;">₹${data.grandTotal}</div>
    </div>
    <div style="font-size: 0.9rem; color: #64748b; margin-bottom: 1.5rem; text-align: center;">
      Do you want to proceed to payment?
    </div>
    <div style="display: flex; gap: 1rem; justify-content: center;">
      <button id="cancelBtn" style="
        flex: 1;
        padding: 0.8rem 1.5rem;
        background: #e2e8f0;
        color: #475569;
        border: none;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      ">Cancel</button>
      <button id="proceedBtn" style="
        flex: 1;
        padding: 0.8rem 1.5rem;
        background: #667eea;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      ">Proceed to Pay</button>
    </div>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  console.log(' Modal created and displayed');

  // Add hover effects
  const cancelBtn = modal.querySelector('#cancelBtn');
  const proceedBtn = modal.querySelector('#proceedBtn');
  
  cancelBtn.addEventListener('mouseenter', () => {
    cancelBtn.style.background = '#cbd5e1';
  });
  cancelBtn.addEventListener('mouseleave', () => {
    cancelBtn.style.background = '#e2e8f0';
  });
  
  proceedBtn.addEventListener('mouseenter', () => {
    proceedBtn.style.background = '#5a67d8';
  });
  proceedBtn.addEventListener('mouseleave', () => {
    proceedBtn.style.background = '#667eea';
  });

  return new Promise((resolve) => {
    cancelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log(' User clicked Cancel');
      modal.remove();
      resolve(false);
    });
    
    proceedBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log(' User clicked Proceed');
      modal.remove();
      resolve(true);
    });
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        console.log(' User clicked backdrop');
        modal.remove();
        resolve(false);
      }
    });
  });
}
// this son of a bitch tolled me around for quite a time now i somehow fixed it please hacker chetanmare dont fw this i dont know how its still working and all , hacker chettamare dont even try to touch this shit i swear 
// Payment handler - FIXED to show modal immediately
payBtn.addEventListener('click', handlePayment);

async function handlePayment(e) {
  e.preventDefault();
  e.stopPropagation();

  console.log('💰 Pay button clicked');

  if (uploadedFilesData.length === 0) {
    alert('Please upload at least one file.');
    return;
  }

  // Calculate prices locally first
  const priceData = calculateLocalPrices();
  
  console.log('Price data calculated:', priceData);

  // Show confirmation modal IMMEDIATELY (no server call needed)
  const userConfirmed = await createConfirmationModal(priceData);
  
  if (!userConfirmed) {
    console.log(' User cancelled - keeping files in queue');
    return; // User cancelled, keep everything as is
  }

  // User confirmed - NOW upload to server
  console.log(' User confirmed - uploading to server...');
  
  const formData = new FormData();
  const options = [];

  uploadedFilesData.forEach((fileData) => {
    const queueItem = fileData.queueElement;
    const copies = parseInt(queueItem.querySelector('.copies-count').textContent);
    const printType = queueItem.querySelector('.print-type-select').value;
    
    let pages = 'all';
    if (printType === 'color') {
      const fromVal = parseInt(queueItem.querySelector('.from-input').value);
      const toVal = parseInt(queueItem.querySelector('.to-input').value);
      pages = `${fromVal}-${toVal}`;
    }

    formData.append('files', fileData.file);

    options.push({
      name: fileData.name,
      printType: printType,
      copies: copies,
      pages: pages
    });
  });

  formData.append('options', JSON.stringify(options));

  payBtn.disabled = true;
  payBtn.textContent = 'Uploading...';

  try {
    const response = await fetch('http://localhost:3000/api/upload', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (result.success) {
      console.log(' Server upload successful');
      
      // TODO: Redirect to payment gateway
      alert('Files uploaded successfully! Redirecting to payment...');
      
      // Clear queue after successful upload
      uploadedFilesData = [];
      queueList.innerHTML = '';
      preview.innerHTML = '<p class="empty">No files uploaded yet...</p>';
      
    } else {
      alert(`Server Error: ${result.message}`);
    }

  } catch (error) {
    console.error(' Upload error:', error);
    alert('Failed to upload files. Server may be offline.\n\nYou can still see the total, but files won\'t be saved until server is running.');
  } finally {
    payBtn.disabled = false;
    payBtn.textContent = 'Continue & Pay';
    updatePayButton();
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

window.addEventListener('DOMContentLoaded', () => {
  const missing = [];
  if (typeof pdfjsLib === 'undefined') missing.push('PDF.js');
  if (typeof JSZip === 'undefined') missing.push('JSZip');
  if (typeof XLSX === 'undefined') missing.push('XLSX');
  
  if (missing.length > 0) {
    console.warn(' Missing libraries:', missing.join(', '));
  } else {
    console.log(' All libraries loaded successfully');
  }
});