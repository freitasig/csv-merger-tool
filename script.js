// State management
let selectedFiles = [];
let detectedColumns = [];
let columnMappings = {};
let activeFilters = [];

let mergedCsvString = null;
let mergedHeaders = [];
let mergedDataRows = [];

// Diagnostic reports state
let validationWarnings = [];
let columnStats = {};

// DOM Elements
const themeToggleBtn = document.getElementById('theme-toggle');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('csv-files');
const filesList = document.getElementById('files-list');
const emptyStateFiles = document.getElementById('empty-state-files');
const fileCountBadge = document.getElementById('file-count');

const mergeModeSelect = document.getElementById('merge-mode');
const joinKeyGroup = document.getElementById('join-key-group');
const joinKeySelect = document.getElementById('join-key');
const joinTypeGroup = document.getElementById('join-type-group');
const joinTypeSelect = document.getElementById('join-type');
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

// Recipe Buttons
const btnExportRecipe = document.getElementById('btn-export-recipe');
const btnImportTrigger = document.getElementById('btn-import-trigger');
const recipeFileInput = document.getElementById('recipe-file-input');

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
    setupPreviewTabSwitching();
    setupFiltersBuilder();
    setupRecipeHandlers();
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

// Preview Area Sub-Tabs Switching
function setupPreviewTabSwitching() {
    const tabButtons = document.querySelectorAll('.preview-tab-btn');
    const tabPanes = document.querySelectorAll('.preview-tab-content');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-prev-tab');
            
            tabButtons.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });
}

// Recipe JSON Loading/Downloading
function setupRecipeHandlers() {
    btnExportRecipe.addEventListener('click', exportRecipe);
    
    btnImportTrigger.addEventListener('click', () => {
        recipeFileInput.click();
    });
    
    recipeFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const recipe = JSON.parse(event.target.result);
                applyRecipe(recipe);
                e.target.value = ''; // Reset input
            } catch (err) {
                updateStatus(`Erro ao importar receita: JSON inválido. ${err.message}`, 'error');
            }
        };
        reader.readAsText(file);
    });
}

function exportRecipe() {
    const recipe = {
        mergeMode: mergeModeSelect.value,
        joinKey: joinKeySelect.value,
        joinType: joinTypeSelect.value,
        columnStrategy: columnStrategySelect.value,
        inputEncoding: inputEncodingSelect.value,
        inputDelimiter: inputDelimiterSelect.value,
        outputDelimiter: outputDelimiterSelect.value,
        outputFilename: outputFilenameInput.value,
        optSourceCol: optSourceColCheckbox.checked,
        optDedup: optDedupCheckbox.checked,
        columnMappings: columnMappings,
        cleanDecimal: document.getElementById('clean-decimal').value,
        cleanDate: document.getElementById('clean-date').value,
        cleanCase: document.getElementById('clean-case').value,
        cleanFillEmpty: document.getElementById('clean-fill-empty').checked,
        cleanFillValue: document.getElementById('clean-fill-value').value,
        activeFilters: activeFilters.map(f => ({ column: f.column, operator: f.operator, value: f.value }))
    };
    
    const jsonString = JSON.stringify(recipe, null, 2);
    downloadFileBlob(jsonString, 'receita_processamento.json', 'application/json');
    updateStatus("Receita exportada com sucesso!", "success");
}

function applyRecipe(recipe) {
    if (!recipe || typeof recipe !== 'object') {
        throw new Error("Receita corrompida ou inválida.");
    }
    
    if (recipe.mergeMode !== undefined) mergeModeSelect.value = recipe.mergeMode;
    if (recipe.columnStrategy !== undefined) columnStrategySelect.value = recipe.columnStrategy;
    if (recipe.inputEncoding !== undefined) inputEncodingSelect.value = recipe.inputEncoding;
    if (recipe.inputDelimiter !== undefined) inputDelimiterSelect.value = recipe.inputDelimiter;
    if (recipe.outputDelimiter !== undefined) outputDelimiterSelect.value = recipe.outputDelimiter;
    if (recipe.outputFilename !== undefined) outputFilenameInput.value = recipe.outputFilename;
    if (recipe.optSourceCol !== undefined) optSourceColCheckbox.checked = recipe.optSourceCol;
    if (recipe.optDedup !== undefined) optDedupCheckbox.checked = recipe.optDedup;
    
    if (recipe.cleanDecimal !== undefined) document.getElementById('clean-decimal').value = recipe.cleanDecimal;
    if (recipe.cleanDate !== undefined) document.getElementById('clean-date').value = recipe.cleanDate;
    if (recipe.cleanCase !== undefined) document.getElementById('clean-case').value = recipe.cleanCase;
    if (recipe.cleanFillEmpty !== undefined) document.getElementById('clean-fill-empty').checked = recipe.cleanFillEmpty;
    if (recipe.cleanFillValue !== undefined) document.getElementById('clean-fill-value').value = recipe.cleanFillValue;
    
    // Set mappings
    if (recipe.columnMappings !== undefined) {
        columnMappings = { ...columnMappings, ...recipe.columnMappings };
    }
    
    // Toggle selector visibility based on merge mode
    const mode = mergeModeSelect.value;
    if (mode === 'simple') {
        strategyGroup.classList.add('hidden');
        joinKeyGroup.classList.add('hidden');
        joinTypeGroup.classList.add('hidden');
    } else if (mode === 'join') {
        strategyGroup.classList.add('hidden');
        joinKeyGroup.classList.remove('hidden');
        joinTypeGroup.classList.remove('hidden');
        if (recipe.joinKey) joinKeySelect.value = recipe.joinKey;
        if (recipe.joinType) joinTypeSelect.value = recipe.joinType;
    } else {
        strategyGroup.classList.remove('hidden');
        joinKeyGroup.classList.add('hidden');
        joinTypeGroup.classList.add('hidden');
    }
    
    // Rebuild active filters
    const builder = document.getElementById('filters-list-builder');
    builder.innerHTML = '';
    activeFilters = [];
    
    if (Array.isArray(recipe.activeFilters)) {
        recipe.activeFilters.forEach(f => {
            const filterId = Math.random().toString(36).substring(2, 9);
            const filterObj = { id: filterId, column: f.column, operator: f.operator, value: f.value };
            activeFilters.push(filterObj);
            
            const row = document.createElement('div');
            row.className = 'filter-row';
            row.id = `filter-${filterId}`;
            
            const colSelect = document.createElement('select');
            colSelect.className = 'filter-col-select';
            colSelect.innerHTML = '<option value="">-- Selecione a Coluna --</option>';
            
            const opSelect = document.createElement('select');
            opSelect.innerHTML = `
                <option value="contains" ${f.operator === 'contains' ? 'selected' : ''}>Contém</option>
                <option value="equals" ${f.operator === 'equals' ? 'selected' : ''}>Igual a</option>
                <option value="starts_with" ${f.operator === 'starts_with' ? 'selected' : ''}>Começa com</option>
                <option value="ends_with" ${f.operator === 'ends_with' ? 'selected' : ''}>Termina com</option>
                <option value="is_empty" ${f.operator === 'is_empty' ? 'selected' : ''}>É Vazio</option>
                <option value="is_not_empty" ${f.operator === 'is_not_empty' ? 'selected' : ''}>Não é Vazio</option>
            `;
            opSelect.addEventListener('change', (e) => {
                filterObj.operator = e.target.value;
                disableDownload();
            });
            
            const valInput = document.createElement('input');
            valInput.type = 'text';
            valInput.value = f.value;
            valInput.placeholder = 'Valor...';
            valInput.addEventListener('input', (e) => {
                filterObj.value = e.target.value;
                disableDownload();
            });
            
            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'btn-delete';
            delBtn.innerHTML = '<i data-lucide="trash-2"></i>';
            delBtn.addEventListener('click', () => {
                activeFilters = activeFilters.filter(fl => fl.id !== filterId);
                row.remove();
                disableDownload();
            });
            
            row.appendChild(colSelect);
            row.appendChild(opSelect);
            row.appendChild(valInput);
            row.appendChild(delBtn);
            builder.appendChild(row);
        });
    }
    
    renderColumnMapper();
    updateFilterColumnSelectors();
    updateJoinKeySelector();
    
    if (window.lucide) {
        window.lucide.createIcons();
    }
    
    updateStatus("Receita carregada com sucesso! Clique em 'Processar' para aplicar as mudanças.", "success");
    disableDownload();
}

// Toggle configurations visibility based on merge mode
mergeModeSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'simple') {
        strategyGroup.classList.add('hidden');
        joinKeyGroup.classList.add('hidden');
        joinTypeGroup.classList.add('hidden');
    } else if (val === 'join') {
        strategyGroup.classList.add('hidden');
        joinKeyGroup.classList.remove('hidden');
        joinTypeGroup.classList.remove('hidden');
    } else {
        strategyGroup.classList.remove('hidden');
        joinKeyGroup.classList.add('hidden');
        joinTypeGroup.classList.add('hidden');
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
        updateJoinKeySelector();
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
    updateJoinKeySelector();
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

function updateJoinKeySelector() {
    if (!joinKeySelect) return;
    const currentVal = joinKeySelect.value;
    joinKeySelect.innerHTML = '<option value="">-- Escolha a coluna chave --</option>';
    detectedColumns.forEach(col => {
        const opt = document.createElement('option');
        opt.value = col;
        opt.textContent = col;
        if (col === currentVal) {
            opt.selected = true;
        }
        joinKeySelect.appendChild(opt);
    });
}

// Data Cleaning Helper Functions
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

// Global Filter and Data Quality Cleaner
function applyFiltersAndCleaning(rows, headers, decimalOpt, dateOpt, textCaseOpt, filters) {
    const fillEmptyActive = document.getElementById('clean-fill-empty').checked;
    const fillEmptyValue = document.getElementById('clean-fill-value').value;
    
    let result = [];
    
    for (let row of rows) {
        let matchesAll = true;
        
        for (let filter of filters) {
            const { column, operator, value } = filter;
            if (!column) continue;
            
            // Map column filter to the mapped/renamed header name
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
                let val = String(cleanRow[i]).trim();
                
                // Impute empty cells
                if (val === "" && fillEmptyActive) {
                    val = fillEmptyValue;
                } else if (val !== "") {
                    if (decimalOpt !== 'none') val = convertDecimal(val, decimalOpt);
                    if (dateOpt !== 'none') val = standardizeDate(val, dateOpt);
                    if (textCaseOpt !== 'none') val = applyTextCase(val, textCaseOpt);
                }
                cleanRow[i] = val;
            }
        } else {
            cleanRow = { ...row };
            for (let key in cleanRow) {
                // Safeguard: Never mutate the added Source File indicator column
                if (key.startsWith("Origem_Arquivo")) continue;
                
                let val = String(cleanRow[key]).trim();
                
                // Impute empty cells
                if (val === "" && fillEmptyActive) {
                    val = fillEmptyValue;
                } else if (val !== "") {
                    if (decimalOpt !== 'none') val = convertDecimal(val, decimalOpt);
                    if (dateOpt !== 'none') val = standardizeDate(val, dateOpt);
                    if (textCaseOpt !== 'none') val = applyTextCase(val, textCaseOpt);
                }
                cleanRow[key] = val;
            }
        }
        result.push(cleanRow);
    }
    
    return result;
}

// Data Quality Validation Rules
function isValidEmail(val) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(val);
}

function isValidCPF(cpf) {
    cpf = String(cpf).replace(/[^\d]/g, '');
    if (cpf.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cpf)) return false; // skip 111.111.111-11, etc.
    
    let sum = 0;
    let remainder;
    
    for (let i = 1; i <= 9; i++) sum = sum + parseInt(cpf.substring(i - 1, i)) * (11 - i);
    remainder = (sum * 10) % 11;
    if ((remainder === 10) || (remainder === 11)) remainder = 0;
    if (remainder !== parseInt(cpf.substring(9, 10))) return false;
    
    sum = 0;
    for (let i = 1; i <= 10; i++) sum = sum + parseInt(cpf.substring(i - 1, i)) * (12 - i);
    remainder = (sum * 10) % 11;
    if ((remainder === 10) || (remainder === 11)) remainder = 0;
    if (remainder !== parseInt(cpf.substring(10, 11))) return false;
    
    return true;
}

function isValidCNPJ(cnpj) {
    cnpj = String(cnpj).replace(/[^\d]/g, '');
    if (cnpj.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(cnpj)) return false;
    
    let size = cnpj.length - 2;
    let numbers = cnpj.substring(0, size);
    const digits = cnpj.substring(size);
    let sum = 0;
    let pos = size - 7;
    for (let i = size; i >= 1; i--) {
        sum += parseInt(numbers.charAt(size - i)) * pos--;
        if (pos < 2) pos = 9;
    }
    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(0))) return false;
    
    size = size + 1;
    numbers = cnpj.substring(0, size);
    sum = 0;
    pos = size - 7;
    for (let i = size; i >= 1; i--) {
        sum += parseInt(numbers.charAt(size - i)) * pos--;
        if (pos < 2) pos = 9;
    }
    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(1))) return false;
    
    return true;
}

// Data quality and profiling analytics
function analyzeDataQuality(headers, rows) {
    validationWarnings = [];
    columnStats = {};
    
    // 1. Detect column types based on first 100 rows
    const sampleRows = rows.slice(0, 100);
    const colTypes = {};
    
    headers.forEach(h => {
        let emailScores = 0;
        let cpfScores = 0;
        let cnpjScores = 0;
        let numericScores = 0;
        let nonEmptyCount = 0;
        
        sampleRows.forEach(row => {
            let val = "";
            if (Array.isArray(row)) {
                const idx = headers.indexOf(h);
                val = row[idx] !== undefined && row[idx] !== null ? String(row[idx]).trim() : "";
            } else {
                val = row[h] !== undefined && row[h] !== null ? String(row[h]).trim() : "";
            }
            
            if (val) {
                nonEmptyCount++;
                const digitsOnly = val.replace(/[^\d]/g, '');
                
                if (val.includes('@') && val.includes('.')) emailScores++;
                else if (digitsOnly.length === 11) cpfScores++;
                else if (digitsOnly.length === 14) cnpjScores++;
                else if (!isNaN(Number(val.replace(',', '.')))) numericScores++;
            }
        });
        
        if (nonEmptyCount === 0) {
            colTypes[h] = 'Texto';
        } else if (emailScores / nonEmptyCount > 0.5) {
            colTypes[h] = 'Email';
        } else if (cpfScores / nonEmptyCount > 0.5) {
            colTypes[h] = 'CPF';
        } else if (cnpjScores / nonEmptyCount > 0.5) {
            colTypes[h] = 'CNPJ';
        } else if (numericScores / nonEmptyCount > 0.5) {
            colTypes[h] = 'Numérico';
        } else {
            colTypes[h] = 'Texto';
        }
    });
    
    // 2. Validate values and compute stats for all rows
    headers.forEach(h => {
        columnStats[h] = {
            type: colTypes[h],
            emptyCount: 0,
            filledCount: 0,
            uniqueValues: new Set(),
            sum: 0,
            min: Infinity,
            max: -Infinity,
            numericCount: 0
        };
    });
    
    rows.forEach((row, rowIdx) => {
        headers.forEach(h => {
            let val = "";
            if (Array.isArray(row)) {
                const idx = headers.indexOf(h);
                val = row[idx] !== undefined && row[idx] !== null ? String(row[idx]).trim() : "";
            } else {
                val = row[h] !== undefined && row[h] !== null ? String(row[h]).trim() : "";
            }
            
            const stats = columnStats[h];
            
            if (val === "") {
                stats.emptyCount++;
            } else {
                stats.filledCount++;
                stats.uniqueValues.add(val);
                
                const type = stats.type;
                if (type === 'Email' && !isValidEmail(val)) {
                    validationWarnings.push({
                        row: rowIdx + 1,
                        col: h,
                        val: val,
                        error: "E-mail inválido"
                    });
                } else if (type === 'CPF' && !isValidCPF(val)) {
                    validationWarnings.push({
                        row: rowIdx + 1,
                        col: h,
                        val: val,
                        error: "CPF inválido"
                    });
                } else if (type === 'CNPJ' && !isValidCNPJ(val)) {
                    validationWarnings.push({
                        row: rowIdx + 1,
                        col: h,
                        val: val,
                        error: "CNPJ inválido"
                    });
                } else if (type === 'Numérico') {
                    const num = Number(val.replace(',', '.'));
                    if (!isNaN(num)) {
                        stats.sum += num;
                        stats.numericCount++;
                        if (num < stats.min) stats.min = num;
                        if (num > stats.max) stats.max = num;
                    } else {
                        validationWarnings.push({
                            row: rowIdx + 1,
                            col: h,
                            val: val,
                            error: "Valor não numérico detectado"
                        });
                    }
                }
            }
        });
    });
    
    // Finalize stats
    headers.forEach(h => {
        const stats = columnStats[h];
        stats.uniqueCount = stats.uniqueValues.size;
        delete stats.uniqueValues; // Free memory
        
        if (stats.numericCount > 0) {
            stats.avg = stats.sum / stats.numericCount;
        } else {
            stats.min = '-';
            stats.max = '-';
            stats.avg = '-';
        }
    });
    
    renderQualityDashboard(headers);
}

function renderQualityDashboard(headers) {
    const container = document.getElementById('prev-tab-quality');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Stats Summary Cards Row
    const summaryCard = document.createElement('div');
    summaryCard.className = 'quality-summary-grid';
    
    // Left side: Validation warnings
    const errorsBox = document.createElement('div');
    errorsBox.className = 'quality-box-card';
    const warnCount = validationWarnings.length;
    
    errorsBox.innerHTML = `
        <h3 style="color:${warnCount > 0 ? 'var(--color-warning)' : 'var(--color-success)'}">
            <i data-lucide="${warnCount > 0 ? 'alert-triangle' : 'check-circle'}"></i>
            Validação de Integridade: ${warnCount} Alerta(s)
        </h3>
        <p style="font-size:0.85rem; color:var(--text-muted); margin-top:0.25rem;">
            Verificamos inconsistências e integridade de e-mails, números, CPFs e CNPJs nas colunas.
        </p>
    `;
    
    if (warnCount > 0) {
        const warningsList = document.createElement('div');
        warningsList.style.maxHeight = '150px';
        warningsList.style.overflowY = 'auto';
        warningsList.style.marginTop = '0.75rem';
        warningsList.style.fontSize = '0.8rem';
        warningsList.style.display = 'flex';
        warningsList.style.flexDirection = 'column';
        warningsList.style.gap = '4px';
        
        validationWarnings.slice(0, 50).forEach(warn => {
            const item = document.createElement('div');
            item.style.padding = '4px 8px';
            item.style.borderRadius = '4px';
            item.style.backgroundColor = 'rgba(245, 158, 11, 0.06)';
            item.style.borderLeft = '3px solid var(--color-warning)';
            item.innerHTML = `Linha <strong>#${warn.row}</strong> | Coluna <strong>${warn.col}</strong>: "${warn.val}" - <span style="color:var(--color-warning);">${warn.error}</span>`;
            warningsList.appendChild(item);
        });
        
        if (warnCount > 50) {
            const more = document.createElement('div');
            more.style.color = 'var(--text-muted)';
            more.style.textAlign = 'center';
            more.style.padding = '4px';
            more.textContent = `... e outros ${warnCount - 50} alertas.`;
            warningsList.appendChild(more);
        }
        errorsBox.appendChild(warningsList);
    } else {
        const successMsg = document.createElement('p');
        successMsg.style.fontSize = '0.9rem';
        successMsg.style.marginTop = '1rem';
        successMsg.style.color = 'var(--color-success)';
        successMsg.textContent = "✓ Nenhuma inconsistência detectada nos formatos padrão!";
        errorsBox.appendChild(successMsg);
    }
    
    // Right side: Statistics summary
    const statsBox = document.createElement('div');
    statsBox.className = 'quality-box-card';
    statsBox.innerHTML = `
        <h3><i data-lucide="bar-chart-3"></i> Resumo Estatístico</h3>
        <ul style="margin-top: 0.75rem; font-size: 0.85rem; display:flex; flex-direction:column; gap:8px; list-style:none;">
            <li>Total de Linhas Processadas: <strong>${mergedDataRows.length}</strong></li>
            <li>Total de Colunas Mapeadas: <strong>${headers.length}</strong></li>
            <li>Colunas Validadas Especialmente: <strong>${headers.filter(h => ['Email','CPF','CNPJ'].includes(columnStats[h].type)).length}</strong></li>
            <li>Qualidade Geral do Preenchimento: <strong>${calculateOverallFillRate()}%</strong></li>
        </ul>
    `;
    
    summaryCard.appendChild(errorsBox);
    summaryCard.appendChild(statsBox);
    container.appendChild(summaryCard);
    
    // Columns Details Profiling Table
    const tableTitle = document.createElement('h3');
    tableTitle.style.marginBottom = '0.5rem';
    tableTitle.textContent = "Perfil das Colunas (Data Profiling)";
    container.appendChild(tableTitle);
    
    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'table-container';
    
    const table = document.createElement('table');
    table.innerHTML = `
        <thead>
            <tr>
                <th>Coluna</th>
                <th>Tipo Detectado</th>
                <th>Preenchimento (%)</th>
                <th>Valores Únicos</th>
                <th>Mínimo</th>
                <th>Máximo</th>
                <th>Média</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;
    
    const tbody = table.querySelector('tbody');
    headers.forEach(h => {
        const stats = columnStats[h];
        const total = stats.emptyCount + stats.filledCount;
        const fillRate = total > 0 ? ((stats.filledCount / total) * 100).toFixed(1) : 0;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${h}</strong></td>
            <td><span class="badge" style="font-size:0.75rem;">${stats.type}</span></td>
            <td>${fillRate}% (${stats.filledCount}/${total})</td>
            <td>${stats.uniqueCount}</td>
            <td>${stats.min !== '-' && typeof stats.min === 'number' ? stats.min.toFixed(2) : stats.min}</td>
            <td>${stats.max !== '-' && typeof stats.max === 'number' ? stats.max.toFixed(2) : stats.max}</td>
            <td>${stats.avg !== '-' && typeof stats.avg === 'number' ? stats.avg.toFixed(2) : stats.avg}</td>
        `;
        tbody.appendChild(tr);
    });
    tableWrapper.appendChild(table);
    container.appendChild(tableWrapper);
    
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

function calculateOverallFillRate() {
    let filled = 0;
    let total = 0;
    for (let key in columnStats) {
        filled += columnStats[key].filledCount;
        total += columnStats[key].emptyCount + columnStats[key].filledCount;
    }
    return total > 0 ? ((filled / total) * 100).toFixed(1) : 0;
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
        } else if (mergeMode === 'simple') {
            await runSimpleMerge(encoding, delimiter, optSourceCol, optDedup, outputDelimiter);
        } else if (mergeMode === 'join') {
            const joinKey = joinKeySelect.value;
            const joinType = joinTypeSelect.value;
            await runJoinMerge(encoding, delimiter, joinKey, joinType, optSourceCol, optDedup, outputDelimiter);
        }

        // Run data validation and profiling reports
        analyzeDataQuality(mergedHeaders, mergedDataRows);

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

// Join Merge: Relate tables laterally by key matching
async function runJoinMerge(encoding, delimiter, joinKey, joinType, optSourceCol, optDedup, outputDelimiter) {
    if (!joinKey) {
        throw new Error("Por favor, selecione uma coluna chave para realizar a união lateral (JOIN) na aba 'União'.");
    }

    let allFilesData = [];
    let headersSet = new Set();
    
    // Add join key first to keep it as first column in output
    headersSet.add(joinKey);

    // Phase 1: Parse all files
    for (let i = 0; i < selectedFiles.length; i++) {
        const fileObj = selectedFiles[i].file;
        updateStatus(`Lendo e mapeando colunas para Join (${i+1}/${selectedFiles.length}): ${fileObj.name}...`, 'processing');
        
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

        mappedHeaders.forEach(h => headersSet.add(h));
    }

    const finalHeaders = Array.from(headersSet);
    
    // Verify key exists in base file
    const baseHeaders = allFilesData[0].headers;
    if (!baseHeaders.includes(joinKey)) {
        throw new Error(`A coluna chave "${joinKey}" não foi encontrada no primeiro arquivo ("${allFilesData[0].fileName}").`);
    }

    // Map: KeyVal -> Combined Row Object
    let joinMap = new Map();
    
    // 1. Populate map with rows from base file
    allFilesData[0].data.forEach(row => {
        const keyVal = String(row[joinKey] !== undefined && row[joinKey] !== null ? row[joinKey] : "").trim();
        if (!keyVal) return; // Skip empty keys
        
        const combined = {};
        finalHeaders.forEach(h => {
            combined[h] = "";
        });
        
        // Populate base values
        baseHeaders.forEach(h => {
            combined[h] = row[h] !== undefined && row[h] !== null ? row[h] : "";
        });
        
        if (optSourceCol) {
            combined["Origem_Arquivo"] = allFilesData[0].fileName;
        }
        
        joinMap.set(keyVal, combined);
    });

    // 2. Loop through subsequent files to join side-by-side
    for (let i = 1; i < allFilesData.length; i++) {
        const fileInfo = allFilesData[i];
        const fileHeaders = fileInfo.headers;
        const currentFileName = fileInfo.fileName;
        
        if (!fileHeaders.includes(joinKey)) {
            if (joinType === 'inner') {
                joinMap.clear();
                break;
            }
            continue; // For left and full joins, skip updating but preserve base records
        }

        const keysFoundInThisFile = new Set();

        fileInfo.data.forEach(row => {
            const keyVal = String(row[joinKey] !== undefined && row[joinKey] !== null ? row[joinKey] : "").trim();
            if (!keyVal) return;

            keysFoundInThisFile.add(keyVal);

            if (joinMap.has(keyVal)) {
                // Key exists: merge values into record
                const targetRow = joinMap.get(keyVal);
                fileHeaders.forEach(h => {
                    if (h !== joinKey) {
                        targetRow[h] = row[h] !== undefined && row[h] !== null ? row[h] : "";
                    }
                });
                if (optSourceCol) {
                    targetRow["Origem_Arquivo"] = targetRow["Origem_Arquivo"] 
                        ? `${targetRow["Origem_Arquivo"]}, ${currentFileName}` 
                        : currentFileName;
                }
            } else if (joinType === 'full') {
                // Key does not exist in base and we are doing Full Join: add new row
                const combined = {};
                finalHeaders.forEach(h => {
                    combined[h] = "";
                });
                
                combined[joinKey] = keyVal;
                fileHeaders.forEach(h => {
                    combined[h] = row[h] !== undefined && row[h] !== null ? row[h] : "";
                });
                
                if (optSourceCol) {
                    combined["Origem_Arquivo"] = currentFileName;
                }
                joinMap.set(keyVal, combined);
            }
        });

        if (joinType === 'inner') {
            // Delete keys from joint map that do not exist in current matched file
            for (let existingKey of joinMap.keys()) {
                if (!keysFoundInThisFile.has(existingKey)) {
                    joinMap.delete(existingKey);
                }
            }
        }
    }

    let combinedRows = Array.from(joinMap.values());

    // Rename Origem_Arquivo to prevent collision if needed
    let finalSourceColName = "Origem_Arquivo";
    if (optSourceCol) {
        let suffix = 1;
        while (finalHeaders.includes(finalSourceColName)) {
            finalSourceColName = `Origem_Arquivo_${suffix}`;
            suffix++;
        }
        finalHeaders.push(finalSourceColName);
        
        if (finalSourceColName !== "Origem_Arquivo") {
            combinedRows.forEach(row => {
                row[finalSourceColName] = row["Origem_Arquivo"];
                delete row["Origem_Arquivo"];
            });
        }
    }

    // Phase 3: Apply data cleaning and row filters
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

// Generate the visual preview grid
function generatePreview(headers, rows) {
    previewTable.innerHTML = '';
    
    if (previewSearch) {
        previewSearch.value = ''; // Reset preview search box filter
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
    
    previewSubset.forEach((row, idx) => {
        const tr = document.createElement('tr');
        
        // Highlight rows with validation warnings
        const actualRowNumber = idx + 1;
        const hasWarning = validationWarnings.some(w => w.row === actualRowNumber);
        if (hasWarning) {
            tr.style.backgroundColor = 'rgba(245, 158, 11, 0.05)';
            tr.style.borderLeft = '3px solid var(--color-warning)';
            tr.title = "Esta linha contém dados com alertas de integridade/validação. Verifique a aba Diagnóstico.";
        }
        
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
            
            // Highlight specific cells that have validation warnings
            const cellHasWarning = validationWarnings.some(w => w.row === actualRowNumber && w.col === h);
            if (cellHasWarning) {
                td.style.color = 'var(--color-warning)';
                td.style.fontWeight = '600';
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
    
    // Switch to first tab in preview area
    const firstTabBtn = document.querySelector('.preview-tab-btn[data-prev-tab="prev-tab-table"]');
    if (firstTabBtn) firstTabBtn.click();
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