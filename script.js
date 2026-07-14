// State management
let selectedFiles = [];
let detectedColumns = [];
let columnMappings = {};
let activeFilters = [];

let mergedCsvString = null;
let mergedHeaders = [];
let mergedDataRows = [];

// DOM Elements
const themeToggleBtn = document.getElementById('theme-toggle');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('csv-files');
const filesList = document.getElementById('files-list');
const emptyStateFiles = document.getElementById('empty-state-files');
const fileCountBadge = document.getElementById('file-count');

const mergeModeSelect = document.getElementById('merge-mode');
const strategyGroup = document.getElementById('strategy-group');
const columnStrategySelect = document.getElementById('column-strategy');
const inputEncodingSelect = document.getElementById('input-encoding');
const inputDelimiterSelect = document.getElementById('input-delimiter');
const outputDelimiterSelect = document.getElementById('output-delimiter');
const outputFilenameInput = document.getElementById('output-filename');
const optSourceColCheckbox = document.getElementById('opt-source-col');
const optDedupCheckbox = document.getElementById('opt-dedup');

const mergeButton = document.getElementById('merge-button');
const downloadButton = document.getElementById('download-button');
const exportFormatSelect = document.getElementById('export-format');
const statusContainer = document.getElementById('status-container');
const statusDiv = document.getElementById('status');

const previewSection = document.getElementById('preview-section');
const previewTable = document.getElementById('preview-table');
const previewSearch = document.getElementById('preview-search');
const statCols = document.getElementById('stat-cols');
const statRows = document.getElementById('stat-rows');

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    // Theme setup
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.className = `${savedTheme}-theme`;
    
    // Lucide Icons initialization
    if (window.lucide) {
        window.lucide.createIcons();
    }
    
    setupTabSwitching();
    setupFiltersBuilder();
    renderFileList();
    scanColumns();
});

// Theme Switcher Logic
themeToggleBtn.addEventListener('click', () => {
    if (document.body.classList.contains('dark-theme')) {
        document.body.className = 'light-theme';
        localStorage.setItem('theme', 'light');
    } else {
        document.body.className = 'dark-theme';
        localStorage.setItem('theme', 'dark');
    }
});

// Tab Switching Setup
function setupTabSwitching() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            
            tabButtons.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });
}

// Toggle configuration visibility based on merge mode
mergeModeSelect.addEventListener('change', (e) => {
    if (e.target.value === 'simple') {
        strategyGroup.classList.add('hidden');
    } else {
        strategyGroup.classList.remove('hidden');
    }
});

// Drag and drop event listeners
dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
});

dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        addFiles(e.target.files);
        e.target.value = ''; // Reset input to allow re-selecting the same file
    }
});

// File list operations
async function addFiles(files) {
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Accept only .csv extension or CSV mime type
        if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
            updateStatus(`Aviso: O arquivo "${file.name}" não parece ser um CSV e foi ignorado.`, 'orange');
            continue;
        }

        // Avoid adding exact duplicate instances
        const isDuplicate = selectedFiles.some(f => f.file.name === file.name && f.file.size === file.size);
        if (isDuplicate) {
            updateStatus(`Aviso: O arquivo "${file.name}" já está na lista.`, 'orange');
            continue;
        }

        selectedFiles.push({
            id: Math.random().toString(36).substring(2, 9),
            file: file
        });
    }
    renderFileList();
    await scanColumns();
    disableDownload();
}

function renderFileList() {
    filesList.innerHTML = '';
    fileCountBadge.textContent = selectedFiles.length;
    
    if (selectedFiles.length === 0) {
        emptyStateFiles.classList.remove('hidden');
        filesList.classList.add('hidden');
        return;
    }
    
    emptyStateFiles.classList.add('hidden');
    filesList.classList.remove('hidden');
    
    selectedFiles.forEach((fileObj, index) => {
        const li = document.createElement('li');
        li.className = 'file-item';
        
        const isFirst = index === 0;
        const isLast = index === selectedFiles.length - 1;
        
        li.innerHTML = `
            <i data-lucide="file-text" class="file-icon"></i>
            <div class="file-info">
                <span class="file-name" title="${fileObj.file.name}">${fileObj.file.name}</span>
                <span class="file-size">${formatFileSize(fileObj.file.size)}</span>
            </div>
            <div class="file-reorder">
                <button type="button" class="btn-arrow btn-up" ${isFirst ? 'disabled' : ''} title="Mover para cima">
                    <i data-lucide="chevron-up"></i>
                </button>
                <button type="button" class="btn-arrow btn-down" ${isLast ? 'disabled' : ''} title="Mover para baixo">
                    <i data-lucide="chevron-down"></i>
                </button>
            </div>
            <button type="button" class="btn-delete" title="Remover arquivo">
                <i data-lucide="trash-2"></i>
            </button>
        `;
        
        // Add action listeners
        li.querySelector('.btn-up').addEventListener('click', () => moveFile(index, 'up'));
        li.querySelector('.btn-down').addEventListener('click', () => moveFile(index, 'down'));
        li.querySelector('.btn-delete').addEventListener('click', () => deleteFile(index));
        
        filesList.appendChild(li);
    });
    
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

async function moveFile(index, direction) {
    if (direction === 'up' && index > 0) {
        const temp = selectedFiles[index];
        selectedFiles[index] = selectedFiles[index - 1];
        selectedFiles[index - 1] = temp;
    } else if (direction === 'down' && index < selectedFiles.length - 1) {
        const temp = selectedFiles[index];
        selectedFiles[index] = selectedFiles[index + 1];
        selectedFiles[index + 1] = temp;
    }
    renderFileList();
    await scanColumns();
    disableDownload();
}

async function deleteFile(index) {
    selectedFiles.splice(index, 1);
    renderFileList();
    await scanColumns();
    disableDownload();
}

// Helpers
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function updateStatus(message, type) {
    statusContainer.classList.remove('hidden');
    statusDiv.className = `status-box status-${type}`;
    
    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'error') iconName = 'alert-triangle';
    if (type === 'orange') iconName = 'alert-circle';
    if (type === 'processing') iconName = 'loader';
    
    statusDiv.innerHTML = `
        <i data-lucide="${iconName}" class="${type === 'processing' ? 'animate-spin' : ''}"></i>
        <span>${message}</span>
    `;
    
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

function disableDownload() {
    downloadButton.disabled = true;
    exportFormatSelect.disabled = true;
    mergedCsvString = null;
    previewSection.classList.add('hidden');
}

// Visual Column Rename Mapping Engine
async function scanColumns() {
    if (selectedFiles.length === 0) {
        detectedColumns = [];
        columnMappings = {};
        renderColumnMapper();
        updateFilterColumnSelectors();
        return;
    }
    
    const columnsSet = new Set();
    const encoding = inputEncodingSelect.value;
    const delimiter = inputDelimiterSelect.value;
    
    for (const fileObj of selectedFiles) {
        try {
            const headers = await parseFirstRow(fileObj.file, encoding, delimiter);
            headers.forEach(h => {
                if (h) columnsSet.add(h.trim());
            });
        } catch (e) {
            console.error("Erro ao ler cabeçalho do arquivo:", fileObj.file.name, e);
        }
    }
    
    detectedColumns = Array.from(columnsSet);
    
    // Clean up mapping and keep existing ones
    const newMappings = {};
    detectedColumns.forEach(col => {
        newMappings[col] = columnMappings[col] || col;
    });
    columnMappings = newMappings;
    
    renderColumnMapper();
    updateFilterColumnSelectors();
}

function parseFirstRow(file, encoding, delimiter) {
    return new Promise((resolve, reject) => {
        const config = {
            preview: 1, // Read only the first row
            header: false,
            encoding: encoding,
            complete: (results) => {
                if (results.data && results.data.length > 0) {
                    resolve(results.data[0]);
                } else {
                    resolve([]);
                }
            },
            error: (err) => reject(err)
        };
        if (delimiter !== 'auto') {
            config.delimiter = delimiter;
        }
        Papa.parse(file, config);
    });
}

function renderColumnMapper() {
    const container = document.getElementById('column-mapper-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (detectedColumns.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 1.5rem;">
                <p style="font-size: 0.85rem;">Adicione arquivos CSV para ver e remapear as colunas.</p>
            </div>
        `;
        return;
    }
    
    const table = document.createElement('table');
    table.className = 'mapper-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>Coluna Original</th>
                <th>Mapear Para (Renomear)</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;
    
    const tbody = table.querySelector('tbody');
    
    detectedColumns.forEach(col => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-size: 0.8rem; font-weight: 500; word-break: break-all;">${col}</td>
            <td>
                <input type="text" class="mapper-input" data-col="${col}" value="${columnMappings[col]}">
            </td>
        `;
        
        tr.querySelector('.mapper-input').addEventListener('input', (e) => {
            columnMappings[col] = e.target.value.trim() || col;
            disableDownload();
        });
        
        tbody.appendChild(tr);
    });
    
    container.appendChild(table);
}

// Row Query Filters Builder
function setupFiltersBuilder() {
    const btnAddFilter = document.getElementById('btn-add-filter');
    if (btnAddFilter) {
        btnAddFilter.addEventListener('click', addFilterRow);
    }
}

function addFilterRow() {
    const builder = document.getElementById('filters-list-builder');
    if (!builder) return;
    
    const filterId = Math.random().toString(36).substring(2, 9);
    const filterObj = { id: filterId, column: '', operator: 'contains', value: '' };
    activeFilters.push(filterObj);
    
    const row = document.createElement('div');
    row.className = 'filter-row';
    row.id = `filter-${filterId}`;
    
    // Column dropdown
    const colSelect = document.createElement('select');
    colSelect.className = 'filter-col-select';
    colSelect.innerHTML = '<option value="">-- Selecione a Coluna --</option>';
    detectedColumns.forEach(col => {
        const opt = document.createElement('option');
        opt.value = col;
        opt.textContent = col;
        colSelect.appendChild(opt);
    });
    colSelect.addEventListener('change', (e) => {
        filterObj.column = e.target.value;
        disableDownload();
    });
    
    // Operator dropdown
    const opSelect = document.createElement('select');
    opSelect.innerHTML = `
        <option value="contains" selected>Contém</option>
        <option value="equals">Igual a</option>
        <option value="starts_with">Começa com</option>
        <option value="ends_with">Termina com</option>
        <option value="is_empty">É Vazio</option>
        <option value="is_not_empty">Não é Vazio</option>
    `;
    opSelect.addEventListener('change', (e) => {
        filterObj.operator = e.target.value;
        disableDownload();
    });
    
    // Value text input
    const valInput = document.createElement('input');
    valInput.type = 'text';
    valInput.placeholder = 'Valor do filtro...';
    valInput.addEventListener('input', (e) => {
        filterObj.value = e.target.value;
        disableDownload();
    });
    
    // Delete action button
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn-delete';
    delBtn.innerHTML = '<i data-lucide="trash-2"></i>';
    delBtn.addEventListener('click', () => {
        activeFilters = activeFilters.filter(f => f.id !== filterId);
        row.remove();
        disableDownload();
    });
    
    row.appendChild(colSelect);
    row.appendChild(opSelect);
    row.appendChild(valInput);
    row.appendChild(delBtn);
    builder.appendChild(row);
    
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

function updateFilterColumnSelectors() {
    const selects = document.querySelectorAll('.filter-col-select');
    selects.forEach(select => {
        const currentVal = select.value;
        select.innerHTML = '<option value="">-- Selecione a Coluna --</option>';
        detectedColumns.forEach(col => {
            const opt = document.createElement('option');
            opt.value = col;
            opt.textContent = col;
            if (col === currentVal) {
                opt.selected = true;
            }
            select.appendChild(opt);
        });
    });
}

// Data Cleaning operations
function convertDecimal(val, option) {
    if (!val || typeof val !== 'string') return val;
    const trimmed = val.trim();
    if (option === 'comma') {
        const isDecimalPoint = /^-?\d+\.\d+$/;
        if (isDecimalPoint.test(trimmed)) {
            return trimmed.replace('.', ',');
        }
    } else if (option === 'dot') {
        const isDecimalComma = /^-?\d+,\d+$/;
        if (isDecimalComma.test(trimmed)) {
            return trimmed.replace(',', '.');
        }
    }
    return val;
}

function standardizeDate(val, option) {
    if (!val || typeof val !== 'string') return val;
    const trimmed = val.trim();
    if (option === 'dmy') {
        // Parse YYYY-MM-DD
        const ymdRegex = /^(\d{4})[-/](\d{2})[-/](\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?.*$/;
        const match = trimmed.match(ymdRegex);
        if (match) {
            return `${match[3]}/${match[2]}/${match[1]}`;
        }
    }
    return val;
}

function applyTextCase(val, option) {
    if (!val || typeof val !== 'string') return val;
    if (option === 'upper') {
        return val.toUpperCase();
    } else if (option === 'lower') {
        return val.toLowerCase();
    } else if (option === 'title') {
        return val.toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase());
    }
    return val;
}

// Global filter executor
function applyFiltersAndCleaning(rows, headers, decimalOpt, dateOpt, textCaseOpt, filters) {
    let result = [];
    
    for (let row of rows) {
        let matchesAll = true;
        
        for (let filter of filters) {
            const { column, operator, value } = filter;
            if (!column) continue;
            
            // Map column selection to mapped/renamed headers
            const mappedColumn = columnMappings[column] || column;
            
            let cellVal = "";
            if (Array.isArray(row)) {
                const idx = headers.indexOf(mappedColumn);
                cellVal = row[idx] !== undefined && row[idx] !== null ? row[idx] : "";
            } else {
                cellVal = row[mappedColumn] !== undefined && row[mappedColumn] !== null ? row[mappedColumn] : "";
            }
            
            const cellStr = String(cellVal).toLowerCase();
            const filterStr = String(value).toLowerCase();
            
            if (operator === 'equals' && cellStr !== filterStr) matchesAll = false;
            else if (operator === 'contains' && !cellStr.includes(filterStr)) matchesAll = false;
            else if (operator === 'starts_with' && !cellStr.startsWith(filterStr)) matchesAll = false;
            else if (operator === 'ends_with' && !cellStr.endsWith(filterStr)) matchesAll = false;
            else if (operator === 'is_empty' && cellStr.trim() !== '') matchesAll = false;
            else if (operator === 'is_not_empty' && cellStr.trim() === '') matchesAll = false;
            
            if (!matchesAll) break;
        }
        
        if (!matchesAll) continue;
        
        // Apply cleaning logic
        let cleanRow;
        if (Array.isArray(row)) {
            cleanRow = [...row];
            for (let i = 0; i < cleanRow.length; i++) {
                let val = String(cleanRow[i]);
                if (decimalOpt !== 'none') val = convertDecimal(val, decimalOpt);
                if (dateOpt !== 'none') val = standardizeDate(val, dateOpt);
                if (textCaseOpt !== 'none') val = applyTextCase(val, textCaseOpt);
                cleanRow[i] = val;
            }
        } else {
            cleanRow = { ...row };
            for (let key in cleanRow) {
                // Safeguard: Never scramble or format the added Source File column
                if (key.startsWith("Origem_Arquivo")) continue;
                
                let val = String(cleanRow[key]);
                if (decimalOpt !== 'none') val = convertDecimal(val, decimalOpt);
                if (dateOpt !== 'none') val = standardizeDate(val, dateOpt);
                if (textCaseOpt !== 'none') val = applyTextCase(val, textCaseOpt);
                cleanRow[key] = val;
            }
        }
        result.push(cleanRow);
    }
    
    return result;
}

// Promisified PapaParse Readers
function parseFileSmart(file, encoding, delimiter) {
    return new Promise((resolve, reject) => {
        const config = {
            header: true,
            skipEmptyLines: 'greedy',
            encoding: encoding,
            complete: (results) => resolve(results),
            error: (err) => reject(err)
        };
        if (delimiter !== 'auto') {
            config.delimiter = delimiter;
        }
        Papa.parse(file, config);
    });
}

function parseFileSimple(file, encoding, delimiter) {
    return new Promise((resolve, reject) => {
        const config = {
            header: false,
            skipEmptyLines: 'greedy',
            encoding: encoding,
            complete: (results) => resolve(results),
            error: (err) => reject(err)
        };
        if (delimiter !== 'auto') {
            config.delimiter = delimiter;
        }
        Papa.parse(file, config);
    });
}

// Main Merge Action Handler
mergeButton.addEventListener('click', async () => {
    if (selectedFiles.length === 0) {
        updateStatus('Por favor, selecione pelo menos um arquivo CSV para continuar.', 'orange');
        return;
    }

    mergeButton.disabled = true;
    disableDownload();
    
    const mergeMode = mergeModeSelect.value;
    const columnStrategy = columnStrategySelect.value;
    const encoding = inputEncodingSelect.value;
    const delimiter = inputDelimiterSelect.value;
    const outputDelimiter = outputDelimiterSelect.value;
    const optSourceCol = optSourceColCheckbox.checked;
    const optDedup = optDedupCheckbox.checked;

    updateStatus('Iniciando processamento e alinhamento dos arquivos...', 'processing');

    try {
        if (mergeMode === 'smart') {
            await runSmartMerge(encoding, delimiter, columnStrategy, optSourceCol, optDedup, outputDelimiter);
        } else {
            await runSimpleMerge(encoding, delimiter, optSourceCol, optDedup, outputDelimiter);
        }

        // Success state
        updateStatus(`Sucesso! Processamento concluído: ${mergedDataRows.length} linhas unidas. Pronto para download.`, 'success');
        downloadButton.disabled = false;
        exportFormatSelect.disabled = false;
        
        // Show table preview
        generatePreview(mergedHeaders, mergedDataRows);
    } catch (err) {
        updateStatus(`Erro no processamento: ${err.message || err}`, 'error');
        console.error("Falha na união do CSV:", err);
    } finally {
        mergeButton.disabled = false;
    }
});

// Smart Merge: Matches headers by names
async function runSmartMerge(encoding, delimiter, columnStrategy, optSourceCol, optDedup, outputDelimiter) {
    let allFilesData = [];
    let headersSet = new Set();
    let intersectionSet = null;

    // Phase 1: Parse all files
    for (let i = 0; i < selectedFiles.length; i++) {
        const fileObj = selectedFiles[i].file;
        updateStatus(`Lendo e mapeando colunas (${i+1}/${selectedFiles.length}): ${fileObj.name}...`, 'processing');
        
        const results = await parseFileSmart(fileObj, encoding, delimiter);
        
        // Trim headers and apply mapping
        const mappedHeaders = (results.meta.fields || []).map(h => {
            const trimmed = h.trim();
            return columnMappings[trimmed] || trimmed;
        });
        
        // Map row keys according to columnMappings
        const mappedRows = (results.data || []).map(row => {
            const mappedRow = {};
            for (const key in row) {
                const trimmedKey = key.trim();
                const mappedKey = columnMappings[trimmedKey] || trimmedKey;
                mappedRow[mappedKey] = row[key];
            }
            return mappedRow;
        });

        allFilesData.push({
            fileName: fileObj.name,
            headers: mappedHeaders,
            data: mappedRows
        });

        // Compute union or intersection of mapped headers
        mappedHeaders.forEach(h => headersSet.add(h));
        if (i === 0) {
            intersectionSet = new Set(mappedHeaders);
        } else {
            intersectionSet = new Set(mappedHeaders.filter(h => intersectionSet.has(h)));
        }
    }

    // Phase 2: Compute final headers
    let finalHeaders = [];
    if (columnStrategy === 'union') {
        finalHeaders = Array.from(headersSet);
    } else {
        finalHeaders = Array.from(intersectionSet);
    }

    if (finalHeaders.length === 0) {
        throw new Error("Nenhuma coluna compatível para mesclar. Tente usar a estratégia 'União'.");
    }

    // Add source file indicator column if checked
    let finalSourceColName = "Origem_Arquivo";
    if (optSourceCol) {
        let suffix = 1;
        while (finalHeaders.includes(finalSourceColName)) {
            finalSourceColName = `Origem_Arquivo_${suffix}`;
            suffix++;
        }
        finalHeaders.push(finalSourceColName);
    }

    // Phase 3: Build unified data structure (filling missing columns)
    let combinedRows = [];
    allFilesData.forEach(fileInfo => {
        fileInfo.data.forEach(row => {
            const normalizedRow = {};
            finalHeaders.forEach(header => {
                if (optSourceCol && header === finalSourceColName) {
                    normalizedRow[header] = fileInfo.fileName;
                } else {
                    normalizedRow[header] = row[header] !== undefined && row[header] !== null ? row[header] : "";
                }
            });
            combinedRows.push(normalizedRow);
        });
    });

    // Phase 4: Apply data cleaning and row filters
    updateStatus("Aplicando filtros de registros e regras de limpeza...", 'processing');
    const cleanDecimalOpt = document.getElementById('clean-decimal').value;
    const cleanDateOpt = document.getElementById('clean-date').value;
    const cleanCaseOpt = document.getElementById('clean-case').value;
    
    combinedRows = applyFiltersAndCleaning(combinedRows, finalHeaders, cleanDecimalOpt, cleanDateOpt, cleanCaseOpt, activeFilters);

    // Deduplication step
    if (optDedup) {
        updateStatus("Removendo linhas duplicadas...", 'processing');
        const seen = new Set();
        combinedRows = combinedRows.filter(row => {
            const serialized = JSON.stringify(row);
            if (seen.has(serialized)) return false;
            seen.add(serialized);
            return true;
        });
    }

    // Save final globally
    mergedHeaders = finalHeaders;
    mergedDataRows = combinedRows;
    mergedCsvString = Papa.unparse(combinedRows, {
        columns: finalHeaders,
        delimiter: outputDelimiter
    });
}

// Simple Merge: Appends rows based on indices
async function runSimpleMerge(encoding, delimiter, optSourceCol, optDedup, outputDelimiter) {
    let combinedRows = [];
    let finalHeaders = [];
    const sourceColName = "Origem_Arquivo";

    // Phase 1: Parse and combine rows based on position
    for (let i = 0; i < selectedFiles.length; i++) {
        const fileObj = selectedFiles[i].file;
        updateStatus(`Lendo arquivo (${i+1}/${selectedFiles.length}): ${fileObj.name}...`, 'processing');

        const results = await parseFileSimple(fileObj, encoding, delimiter);
        const rows = results.data || [];
        
        if (rows.length === 0) continue;
        
        // Map file headers using columnMappings
        const fileHeaders = rows[0].map(h => {
            const trimmed = h.trim();
            return columnMappings[trimmed] || trimmed;
        });
        const fileData = rows.slice(1);

        if (i === 0) {
            // First file sets the header template
            finalHeaders = [...fileHeaders];
            if (optSourceCol) {
                finalHeaders.push(sourceColName);
            }
            // Push header row
            combinedRows.push(finalHeaders);
        }

        const headerLen = optSourceCol ? finalHeaders.length - 1 : finalHeaders.length;

        fileData.forEach(row => {
            let alignedRow = [...row];
            
            // Adjust row columns length to match first file header template
            if (alignedRow.length < headerLen) {
                while (alignedRow.length < headerLen) {
                    alignedRow.push("");
                }
            } else if (alignedRow.length > headerLen) {
                alignedRow = alignedRow.slice(0, headerLen);
            }

            if (optSourceCol) {
                alignedRow.push(fileObj.name);
            }
            combinedRows.push(alignedRow);
        });
    }

    if (combinedRows.length <= 1) {
        throw new Error("Nenhum dado de linha válido encontrado nos arquivos.");
    }

    const headers = combinedRows[0];
    let dataRows = combinedRows.slice(1);

    // Apply data cleaning and row filters
    updateStatus("Aplicando filtros de registros e regras de limpeza...", 'processing');
    const cleanDecimalOpt = document.getElementById('clean-decimal').value;
    const cleanDateOpt = document.getElementById('clean-date').value;
    const cleanCaseOpt = document.getElementById('clean-case').value;
    
    dataRows = applyFiltersAndCleaning(dataRows, headers, cleanDecimalOpt, cleanDateOpt, cleanCaseOpt, activeFilters);

    // Deduplication step
    if (optDedup) {
        updateStatus("Removendo linhas duplicadas...", 'processing');
        const seen = new Set();
        dataRows = dataRows.filter(row => {
            const serialized = JSON.stringify(row);
            if (seen.has(serialized)) return false;
            seen.add(serialized);
            return true;
        });
    }

    // Save final globally
    mergedHeaders = headers;
    mergedDataRows = dataRows;
    
    // Convert all back to CSV (rebuilding combined list)
    const finalOutput = [headers, ...dataRows];
    mergedCsvString = Papa.unparse(finalOutput, {
        delimiter: outputDelimiter
    });
}

// Generate the visual preview grid
function generatePreview(headers, rows) {
    previewTable.innerHTML = '';
    
    if (previewSearch) {
        previewSearch.value = ''; // Reset preview search box
    }
    
    // Header block
    const thead = document.createElement('thead');
    const headerTr = document.createElement('tr');
    headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        headerTr.appendChild(th);
    });
    thead.appendChild(headerTr);
    previewTable.appendChild(thead);

    // Body block
    const tbody = document.createElement('tbody');
    // Preview up to 10 rows
    const previewSubset = rows.slice(0, 10);
    
    previewSubset.forEach(row => {
        const tr = document.createElement('tr');
        headers.forEach(h => {
            const td = document.createElement('td');
            let cellVal = "";
            if (Array.isArray(row)) {
                // If simple merge, row is array matching headers order
                const index = headers.indexOf(h);
                cellVal = row[index] !== undefined && row[index] !== null ? row[index] : "";
            } else {
                // If smart merge, row is object
                cellVal = row[h] !== undefined && row[h] !== null ? row[h] : "";
            }
            td.textContent = cellVal;
            td.title = cellVal; // Display raw tooltip on hover
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    previewTable.appendChild(tbody);

    // Update metadata panel stats
    statCols.textContent = headers.length;
    statRows.textContent = rows.length;

    // Show preview area
    previewSection.classList.remove('hidden');
}

// Live Search Filter on Preview Grid
if (previewSearch) {
    previewSearch.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        const rows = previewTable.querySelectorAll('tbody tr');
        
        rows.forEach(row => {
            const rowText = row.textContent.toLowerCase();
            if (rowText.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    });
}

// Multi-Format Downloader trigger
downloadButton.addEventListener('click', () => {
    if (mergedDataRows.length === 0) return;
    
    const format = exportFormatSelect.value;
    const outputFilename = outputFilenameInput.value.trim() || 'arquivos_unidos.csv';
    const cleanFilename = outputFilename.replace(/\.[^/.]+$/, ""); // Strip existing extension
    
    if (format === 'json') {
        updateStatus("Gerando arquivo JSON...", "processing");
        // Structure simple merge array of arrays into standard key-value objects
        let jsonData = [];
        if (mergeModeSelect.value === 'simple') {
            mergedDataRows.forEach(row => {
                const obj = {};
                mergedHeaders.forEach((h, idx) => {
                    obj[h] = row[idx] !== undefined && row[idx] !== null ? row[idx] : "";
                });
                jsonData.push(obj);
            });
        } else {
            jsonData = mergedDataRows;
        }
        
        const jsonString = JSON.stringify(jsonData, null, 2);
        downloadFileBlob(jsonString, `${cleanFilename}.json`, 'application/json');
        updateStatus(`JSON baixado com sucesso: ${cleanFilename}.json`, "success");
        
    } else if (format === 'xlsx') {
        if (!window.XLSX) {
            updateStatus("Erro: A biblioteca XLSX de exportação do Excel falhou em carregar.", "error");
            return;
        }
        
        updateStatus("Gerando arquivo Excel (.xlsx)...", "processing");
        
        const wb = XLSX.utils.book_new();
        let ws;
        
        if (mergeModeSelect.value === 'simple') {
            const dataWithHeader = [mergedHeaders, ...mergedDataRows];
            ws = XLSX.utils.aoa_to_sheet(dataWithHeader);
        } else {
            ws = XLSX.utils.json_to_sheet(mergedDataRows, { header: mergedHeaders });
        }
        
        XLSX.utils.book_append_sheet(wb, ws, "Dados Unidos");
        XLSX.writeFile(wb, `${cleanFilename}.xlsx`);
        updateStatus(`Planilha Excel baixada com sucesso: ${cleanFilename}.xlsx`, "success");
        
    } else {
        // Default CSV export with UTF-8 BOM
        updateStatus("Gerando arquivo CSV...", "processing");
        const BOM = "\uFEFF";
        downloadFileBlob(BOM + mergedCsvString, `${cleanFilename}.csv`, 'text/csv;charset=utf-8;');
        updateStatus(`Arquivo CSV baixado com sucesso: ${cleanFilename}.csv`, "success");
    }
});

function downloadFileBlob(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}