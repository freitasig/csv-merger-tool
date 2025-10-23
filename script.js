// 1. Pega os elementos do HTML
const fileInput = document.getElementById('csv-files');
const mergeButton = document.getElementById('merge-button');
const statusDiv = document.getElementById('status');

// 2. Adiciona o evento de clique ao botão
mergeButton.addEventListener('click', () => {
    const files = fileInput.files;

    // Validação inicial: Pelo menos um arquivo
    if (files.length === 0) {
        updateStatus('Por favor, selecione pelo menos um arquivo CSV.', 'orange');
        return;
    }

    // Desabilita o botão e atualiza o status para iniciar o processamento
    mergeButton.disabled = true;
    updateStatus(`Iniciando processamento de ${files.length} arquivo(s)...`, 'processing');

    unirArquivosCSV(files);
});

/**
 * Função para atualizar o status e aplicar estilos com base no tipo.
 * @param {string} message - A mensagem a ser exibida.
 * @param {string} type - 'success', 'error', 'orange', ou 'processing'.
 */
function updateStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status-${type}`;
}


// 3. Função principal para unir os arquivos
async function unirArquivosCSV(files) {
    let mergedData = [];
    let dataRowCount = 0; 
    let isFirstFile = true;
    let successfulFiles = 0;

    try {
        for (const file of files) {
            updateStatus(`Processando arquivo: ${file.name}...`, 'processing');

            const data = await parseCSV(file);
            
            if (data.length === 0) {
                 updateStatus(`Aviso: O arquivo ${file.name} está vazio e foi ignorado.`, 'orange');
                 continue;
            }

            // O PapaParse retorna o array de dados
            if (isFirstFile) {
                // Adiciona o cabeçalho (primeira linha)
                mergedData.push(data[0]); 
                
                // Adiciona os dados (todas as linhas exceto a primeira)
                const fileData = data.slice(1);
                mergedData.push(...fileData); 
                dataRowCount += fileData.length;

                isFirstFile = false;
            } else {
                // Para arquivos subsequentes: Adiciona apenas os dados (ignorando o cabeçalho)
                const fileData = data.slice(1);
                mergedData.push(...fileData);
                dataRowCount += fileData.length;
            }
            successfulFiles++;
        }

        // Validação final de dados (verifica se há pelo menos o cabeçalho + 1 linha de dados)
        if (mergedData.length <= 1) { 
            updateStatus('Arquivos processados, mas nenhum dado útil encontrado para download.', 'orange');
            return;
        }

        // 4. Converte os dados unidos de volta para o formato CSV e inicia o download
        const csvFinal = Papa.unparse(mergedData, {
             // Garante que o UTF-8 seja explicitamente definido, embora o Blob já ajude
             encoding: "utf8" 
        }); 
        downloadCSV(csvFinal, 'arquivos_unidos.csv');
        
        // Feedback final de sucesso
        const feedbackText = files.length > 1
            ? `Sucesso! ${successfulFiles} arquivo(s) processados e ${dataRowCount} linhas de dados unidas. Download iniciado.`
            : `Sucesso! Arquivo processado com ${dataRowCount} linhas de dados. Download iniciado.`;
            
        updateStatus(feedbackText, 'success');

    } catch (error) {
        updateStatus(`Erro fatal durante o processamento: ${error.message || error}`, 'error');
        console.error("Erro na união do CSV:", error);
    } finally {
        // Habilita o botão DE NOVO, independentemente do sucesso ou falha
        mergeButton.disabled = false;
    }
}

// Função auxiliar que "promete" o resultado do PapaParse
function parseCSV(file) {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: false, // Fundamental para ter controle sobre o cabeçalho
            skipEmptyLines: true, 
            complete: (results) => resolve(results.data),
            error: (error) => reject(error)
        });
    });
}

// Função para acionar o download do arquivo no navegador
function downloadCSV(csvString, fileName) {
    // Adiciona o charset utf-8 explicitamente ao Blob
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.display = 'none'; // Usa display: none em vez de visibility
    
    document.body.appendChild(link);
    link.click();
    
    // Limpeza
    document.body.removeChild(link);
    URL.revokeObjectURL(url); 
}