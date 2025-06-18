// 1. Pega os elementos do HTML
const fileInput = document.getElementById('csv-files');
const mergeButton = document.getElementById('merge-button');
const statusDiv = document.getElementById('status');

// 2. Adiciona o evento de clique ao botão
mergeButton.addEventListener('click', () => {
    const files = fileInput.files;

    // Validação inicial
    if (files.length < 2) {
        statusDiv.textContent = 'Por favor, selecione pelo menos 2 arquivos CSV.';
        statusDiv.style.color = 'red';
        return;
    }

    statusDiv.textContent = 'Processando...';
    statusDiv.style.color = 'black';

    unirArquivosCSV(files);
});

// 3. Função principal para unir os arquivos
async function unirArquivosCSV(files) {
    let mergedData = [];
    let header = [];
    let isFirstFile = true;

    for (const file of files) {
        try {
            // Usa uma Promise para esperar o PapaParse terminar de ler o arquivo
            const data = await parseCSV(file);
            
            if (isFirstFile) {
                header = data[0]; // Pega o cabeçalho do primeiro arquivo
                mergedData.push(header);
                mergedData.push(...data.slice(1)); // Adiciona os dados (sem o cabeçalho)
                isFirstFile = false;
            } else {
                // Para os outros arquivos, só adiciona os dados, ignorando seus cabeçalhos
                mergedData.push(...data.slice(1));
            }
        } catch (error) {
            statusDiv.textContent = `Erro ao ler o arquivo ${file.name}: ${error.message}`;
            statusDiv.style.color = 'red';
            return;
        }
    }

    // 4. Converte os dados unidos de volta para o formato CSV e inicia o download
    const csvFinal = Papa.unparse(mergedData);
    downloadCSV(csvFinal, 'arquivos_unidos.csv');
    statusDiv.textContent = 'Arquivos unidos com sucesso! Download iniciado.';
    statusDiv.style.color = 'green';
}

// Função auxiliar que "promete" o resultado do PapaParse
function parseCSV(file) {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            complete: (results) => resolve(results.data),
            error: (error) => reject(error)
        });
    });
}

// Função para acionar o download do arquivo no navegador
function downloadCSV(csvString, fileName) {
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}