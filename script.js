let pnlChartInstance = null;
let winLossChartInstance = null;
let dayChartInstance = null;
let allTrades = [];
let chartMode = 'cumulative'; // or 'daily'

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Load trades from localStorage on startup
    loadTradesFromStorage();

    // File input listener
    const fileInput = document.getElementById('csvFileInput');
    const fileNameDisplay = document.getElementById('fileName');

    fileInput.addEventListener('change', (event) => {
        if (event.target.files.length > 0) {
            const file = event.target.files[0];
            fileNameDisplay.textContent = file.name;
            handleFileUpload(file);
        } else {
            fileNameDisplay.textContent = 'No file selected';
        }
    });

    // Chart toggle buttons
    document.querySelectorAll('.chart-toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.chart-toggle-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            chartMode = e.target.dataset.chart;
            updateChart();
        });
    });

    // Modal controls
    const addTradeBtn = document.getElementById('addTradeBtn');
    const modal = document.getElementById('addTradeModal');
    const closeModal = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');
    const addTradeForm = document.getElementById('addTradeForm');

    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('tradeDate').value = today;

    addTradeBtn.addEventListener('click', () => {
        modal.classList.add('active');
        setTimeout(() => lucide.createIcons(), 100);
    });

    closeModal.addEventListener('click', () => {
        modal.classList.remove('active');
        addTradeForm.reset();
        document.getElementById('tradeDate').value = today;
    });

    cancelBtn.addEventListener('click', () => {
        modal.classList.remove('active');
        addTradeForm.reset();
        document.getElementById('tradeDate').value = today;
    });

    // Close modal on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            addTradeForm.reset();
            document.getElementById('tradeDate').value = today;
        }
    });

    // Real-time P&L calculation
    const entryInput = document.getElementById('tradeEntry');
    const exitInput = document.getElementById('tradeExit');
    const quantityInput = document.getElementById('tradeQuantity');
    const sideInput = document.getElementById('tradeSide');

    function calculatePnL() {
        const entry = parseFloat(entryInput.value) || 0;
        const exit = parseFloat(exitInput.value) || 0;
        const quantity = parseFloat(quantityInput.value) || 0;
        const side = sideInput.value;

        let pnl = 0;
        if (side === 'Long') {
            pnl = (exit - entry) * quantity;
        } else if (side === 'Short') {
            pnl = (entry - exit) * quantity;
        }

        const pnlDisplay = getCurrencyDisplay(pnl);
        const pnlElement = document.getElementById('calculatedPnl');
        pnlElement.textContent = pnlDisplay.formatted;
        pnlElement.className = `text-3xl font-bold ${pnlDisplay.colorClass}`;
    }

    entryInput.addEventListener('input', calculatePnL);
    exitInput.addEventListener('input', calculatePnL);
    quantityInput.addEventListener('input', calculatePnL);
    sideInput.addEventListener('change', calculatePnL);

    // Form submission
    addTradeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const entry = parseFloat(entryInput.value);
        const exit = parseFloat(exitInput.value);
        const quantity = parseFloat(quantityInput.value);
        const side = sideInput.value;

        let pnl = 0;
        if (side === 'Long') {
            pnl = (exit - entry) * quantity;
        } else if (side === 'Short') {
            pnl = (entry - exit) * quantity;
        }

        const newTrade = {
            date: new Date(document.getElementById('tradeDate').value),
            symbol: document.getElementById('tradeSymbol').value.toUpperCase(),
            side: side,
            quantity: quantity,
            entry: entry,
            exit: exit,
            pnl: pnl,
            notes: document.getElementById('tradeNotes').value || ''
        };

        addTrade(newTrade);
        modal.classList.remove('active');
        addTradeForm.reset();
        document.getElementById('tradeDate').value = today;
    });

    // Export button
    const exportBtn = document.getElementById('exportBtn');
    exportBtn.addEventListener('click', exportToCSV);

    // Clear all button
    const clearAllBtn = document.getElementById('clearAllBtn');
    clearAllBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to delete all trades? This cannot be undone.')) {
            allTrades = [];
            saveTradesToStorage();
            updateDashboard();
            document.getElementById('exportBtn').style.display = 'none';
        }
    });
});

/**
 * Handles CSV file upload and parsing
 */
function handleFileUpload(file) {
    if (!file) return;

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        complete: (results) => {
            console.log("Parsed CSV data:", results);
            
            if (results.errors.length > 0) {
                console.error("Parse errors:", results.errors);
            }
            
            if (!results.data || results.data.length === 0) {
                alert('No data found in CSV file. Please check the file format.');
                return;
            }
            
            if (results.meta && results.meta.fields) {
                console.log("CSV Headers:", results.meta.fields);
            }
            
            processCSVData(results.data);
        },
        error: (err) => {
            console.error("PapaParse Error:", err);
            alert(`Error parsing CSV: ${err.message}`);
        }
    });
}

/**
 * Process CSV data - handles multiple possible header formats
 */
function processCSVData(data) {
    console.log("Processing", data.length, "rows");
    
    const parsedTrades = [];
    let skippedRows = 0;

    data.forEach((row, index) => {
        try {
            // Handle date variations
            const dateValue = row['dateStart'] || row['Date'] || row['date'] || row['Open Time'] || 
                            row['TIME'] || row['Time'] || row['Entry Time'];
            
            // Handle P&L variations (including rPnL from your CSV)
            const pnlValue = row['rPnL'] || row['P&L'] || row['pnl'] || row['uPnL'] || 
                           row['Profit/Loss'] || row['Profit'] || row['PL'];
            
            // Handle symbol variations
            const symbolValue = row['pair'] || row['Symbol'] || row['symbol'] || row['Ticker'] || row['stock'];
            
            // Handle side variations
            const sideValue = row['side'] || row['Side'] || row['Type'] || row['Direction'];
            
            // Handle quantity variations
            const qtyValue = row['amount'] || row['Quantity'] || row['quantity'] || row['Qty'] || 
                           row['Size'] || row['Shares'];
            
            // Handle entry price
            const entryValue = row['entryPrice'] || row['Entry'] || row['entry'] || 
                             row['Entry Price'] || row['Open'];
            
            // Handle exit price
            const exitValue = row['avgClosePrice'] || row['Exit'] || row['exit'] || 
                            row['Exit Price'] || row['Close'];
            
            // Handle risk:reward
            const rrValue = row['avgRiskReward'] || row['maxRiskReward'] || row['R:R'] || row['RR'];
            
            // Handle notes
            const notesValue = row['tags'] || row['Notes'] || row['notes'] || row['Comment'] || '';

            // Parse date
            let tradeDate;
            if (dateValue) {
                tradeDate = new Date(dateValue);
                if (isNaN(tradeDate.getTime())) {
                    console.warn(`Invalid date in row ${index + 1}:`, dateValue);
                    skippedRows++;
                    return;
                }
            } else {
                console.warn(`No date found in row ${index + 1}`);
                skippedRows++;
                return;
            }

            // Parse P&L
            let pnl;
            if (pnlValue !== undefined && pnlValue !== null && pnlValue !== '') {
                const pnlStr = String(pnlValue).replace(/[$,\s]/g, '');
                pnl = parseFloat(pnlStr);
                if (isNaN(pnl)) {
                    console.warn(`Invalid P&L in row ${index + 1}:`, pnlValue);
                    skippedRows++;
                    return;
                }
            } else {
                console.warn(`No P&L found in row ${index + 1}`);
                skippedRows++;
                return;
            }

            // Parse other numeric fields
            const quantity = parseFloat(String(qtyValue || '0').replace(/[^0-9.-]/g, '')) || 0;
            const entry = parseFloat(String(entryValue || '0').replace(/[^0-9.-]/g, '')) || 0;
            const exit = parseFloat(String(exitValue || '0').replace(/[^0-9.-]/g, '')) || 0;
            const rr = parseFloat(String(rrValue || '0').replace(/[^0-9.-]/g, '')) || 0;

            parsedTrades.push({
                date: tradeDate,
                symbol: symbolValue || 'N/A',
                side: sideValue || 'N/A',
                quantity: quantity,
                entry: entry,
                exit: exit,
                pnl: pnl,
                riskReward: rr,
                notes: notesValue
            });
        } catch (error) {
            console.error(`Error processing row ${index + 1}:`, error, row);
            skippedRows++;
        }
    });

    console.log(`Successfully parsed ${parsedTrades.length} trades, skipped ${skippedRows} rows`);

    if (parsedTrades.length === 0) {
        alert('No valid trades found in CSV. Please check your CSV format.');
        return;
    }

    // Merge with existing trades
    allTrades = [...allTrades, ...parsedTrades];
    allTrades.sort((a, b) => a.date - b.date);
    
    saveTradesToStorage();
    updateDashboard();
    
    document.getElementById('exportBtn').style.display = 'inline-block';
    
    alert(`Successfully imported ${parsedTrades.length} trades!${skippedRows > 0 ? `\n${skippedRows} rows were skipped.` : ''}`);
}

/**
 * Add a single trade
 */
function addTrade(trade) {
    // Calculate risk:reward if entry and exit are provided
    if (trade.entry && trade.exit && trade.side) {
        const priceDiff = Math.abs(trade.exit - trade.entry);
        const initialStop = trade.entry * (trade.side === 'Long' ? 0.98 : 1.02); // Assume 2% stop
        const stopDiff = Math.abs(trade.entry - initialStop);
        trade.riskReward = stopDiff > 0 ? priceDiff / stopDiff : 0;
    } else {
        trade.riskReward = 0;
    }
    
    allTrades.push(trade);
    allTrades.sort((a, b) => a.date - b.date);
    saveTradesToStorage();
    updateDashboard();
    document.getElementById('exportBtn').style.display = 'inline-block';
}

/**
 * Delete a trade
 */
function deleteTrade(index) {
    if (confirm('Are you sure you want to delete this trade?')) {
        allTrades.splice(index, 1);
        saveTradesToStorage();
        updateDashboard();
        
        if (allTrades.length === 0) {
            document.getElementById('exportBtn').style.display = 'none';
        }
    }
}

/**
 * Save trades to localStorage
 */
function saveTradesToStorage() {
    try {
        const tradesJSON = JSON.stringify(allTrades.map(t => ({
            ...t,
            date: t.date.toISOString()
        })));
        localStorage.setItem('tradezilla_trades', tradesJSON);
    } catch (error) {
        console.error('Error saving to localStorage:', error);
    }
}

/**
 * Load trades from localStorage
 */
function loadTradesFromStorage() {
    try {
        const tradesJSON = localStorage.getItem('tradezilla_trades');
        if (tradesJSON) {
            const loadedTrades = JSON.parse(tradesJSON);
            allTrades = loadedTrades.map(t => ({
                ...t,
                date: new Date(t.date)
            }));
            updateDashboard();
            
            if (allTrades.length > 0) {
                document.getElementById('exportBtn').style.display = 'inline-block';
            }
        }
    } catch (error) {
        console.error('Error loading from localStorage:', error);
    }
}

/**
 * Update entire dashboard
 */
function updateDashboard() {
    if (allTrades.length === 0) {
        resetDashboard();
        return;
    }

    // Calculate KPIs
    const totalTrades = allTrades.length;
    const winningTrades = allTrades.filter(t => t.pnl > 0).length;
    const losingTrades = allTrades.filter(t => t.pnl < 0).length;
    
    const totalPnl = allTrades.reduce((sum, t) => sum + t.pnl, 0);
    const totalWins = allTrades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0);
    const totalLosses = Math.abs(allTrades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0));
    const avgTrade = totalPnl / totalTrades;
    
    const winRate = (winningTrades + losingTrades) > 0 ? (winningTrades / (winningTrades + losingTrades)) * 100 : 0;
    const profitFactor = totalLosses > 0 ? (totalWins / totalLosses) : (totalWins > 0 ? Infinity : 0);

    // Update KPIs
    const pnlDisplay = getCurrencyDisplay(totalPnl);
    document.getElementById('kpi-total-pnl').textContent = pnlDisplay.formatted;
    document.getElementById('kpi-total-pnl').className = `metric-value ${pnlDisplay.colorClass}`;
    
    // P&L change indicator
    const firstTradePnl = allTrades[0].pnl;
    const changePercent = firstTradePnl !== 0 ? ((totalPnl / Math.abs(firstTradePnl)) * 100).toFixed(1) : 0;
    document.getElementById('pnl-change').textContent = `${changePercent > 0 ? '+' : ''}${changePercent}%`;
    
    document.getElementById('kpi-win-rate').textContent = winRate.toFixed(1) + '%';
    document.getElementById('win-loss-ratio').textContent = `${winningTrades} W / ${losingTrades} L`;
    
    document.getElementById('kpi-profit-factor').textContent = profitFactor === Infinity ? '∞' : profitFactor.toFixed(2);
    
    document.getElementById('kpi-total-trades').textContent = totalTrades;
    document.getElementById('avg-trade').textContent = `Avg: ${getCurrencyDisplay(avgTrade).formatted}`;

    // Update trade table
    updateTradeTable();
    
    // Update charts
    updateChart();
    updateWinLossChart(winningTrades, losingTrades);
    updateSymbolPerformance();
    updateDayChart();
    
    // Reinitialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

/**
 * Reset dashboard to empty state
 */
function resetDashboard() {
    document.getElementById('kpi-total-pnl').textContent = '$0.00';
    document.getElementById('kpi-total-pnl').className = 'metric-value pnl-neutral';
    document.getElementById('pnl-change').textContent = '--';
    document.getElementById('kpi-win-rate').textContent = '0.0%';
    document.getElementById('win-loss-ratio').textContent = '0 W / 0 L';
    document.getElementById('kpi-profit-factor').textContent = '0.00';
    document.getElementById('kpi-total-trades').textContent = '0';
    document.getElementById('avg-trade').textContent = 'Avg: $0.00';
    
    document.getElementById('trade-log-body').innerHTML = `
        <tr>
            <td colspan="10" class="p-8 text-center text-slate-500">
                <div class="flex flex-col items-center gap-4">
                    <i data-lucide="inbox" style="width: 48px; height: 48px;" class="text-slate-600"></i>
                    <p>Upload a CSV file or add trades manually to get started.</p>
                </div>
            </td>
        </tr>
    `;
    
    document.getElementById('symbolPerformance').innerHTML = '<p class="text-center text-slate-500 py-8">No data available</p>';
    
    if (pnlChartInstance) pnlChartInstance.destroy();
    if (winLossChartInstance) winLossChartInstance.destroy();
    if (dayChartInstance) dayChartInstance.destroy();
    
    lucide.createIcons();
}

/**
 * Update trade table
 */
function updateTradeTable() {
    const tradeLogHtml = allTrades.map((trade, index) => {
        const pnlDisplay = getCurrencyDisplay(trade.pnl);
        const rrDisplay = trade.riskReward ? trade.riskReward.toFixed(2) : '--';
        
        return `
            <tr class="hover:bg-slate-700/50">
                <td class="px-4 py-3 whitespace-nowrap text-sm text-slate-300">${trade.date.toLocaleDateString()}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-white">${trade.symbol}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm">
                    <span class="px-2 py-1 rounded text-xs font-semibold ${trade.side === 'Long' || trade.side === 'buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}">
                        ${trade.side}
                    </span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-slate-300">${trade.quantity.toFixed(2)}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-slate-300">${trade.entry ? '$' + trade.entry.toFixed(2) : '--'}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-slate-300">${trade.exit ? '$' + trade.exit.toFixed(2) : '--'}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm font-bold ${pnlDisplay.colorClass}">${pnlDisplay.formatted}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-slate-300">${rrDisplay}</td>
                <td class="px-4 py-3 text-sm text-slate-400 max-w-xs truncate" title="${trade.notes}">${trade.notes || '-'}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm">
                    <button onclick="deleteTrade(${index})" class="btn-icon" title="Delete trade">
                        <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    document.getElementById('trade-log-body').innerHTML = tradeLogHtml;
}

/**
 * Update P&L chart (cumulative or daily)
 */
function updateChart() {
    const ctx = document.getElementById('pnlChart').getContext('2d');
    
    if (pnlChartInstance) {
        pnlChartInstance.destroy();
    }

    let chartData;
    if (chartMode === 'cumulative') {
        let cumulativePnl = 0;
        chartData = {
            labels: allTrades.map(t => t.date),
            data: allTrades.map(t => {
                cumulativePnl += t.pnl;
                return cumulativePnl;
            })
        };
    } else {
        chartData = {
            labels: allTrades.map(t => t.date),
            data: allTrades.map(t => t.pnl)
        };
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, 350);
    gradient.addColorStop(0, 'rgba(14, 165, 233, 0.4)');
    gradient.addColorStop(1, 'rgba(14, 165, 233, 0.0)');

    pnlChartInstance = new Chart(ctx, {
        type: chartMode === 'cumulative' ? 'line' : 'bar',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: chartMode === 'cumulative' ? 'Cumulative P&L' : 'Daily P&L',
                data: chartData.data,
                borderColor: '#0EA5E9',
                backgroundColor: chartMode === 'cumulative' ? gradient : chartData.data.map(v => v >= 0 ? 'rgba(34, 197, 94, 0.6)' : 'rgba(239, 68, 68, 0.6)'),
                borderWidth: 2,
                pointRadius: chartMode === 'cumulative' ? 0 : 0,
                pointHoverRadius: 5,
                tension: 0.1,
                fill: chartMode === 'cumulative',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        tooltipFormat: 'MMM d, yyyy',
                    },
                    grid: {
                        color: 'rgba(148, 163, 184, 0.1)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#94A3B8'
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(148, 163, 184, 0.1)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#94A3B8',
                        callback: (value) => `$${value.toFixed(0)}`
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#F1F5F9',
                    bodyColor: '#F1F5F9',
                    borderColor: 'rgba(14, 165, 233, 0.5)',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: (context) => `P&L: ${getCurrencyDisplay(context.parsed.y).formatted}`
                    }
                }
            }
        }
    });
}

/**
 * Export trades to CSV
 */
function exportToCSV() {
    if (allTrades.length === 0) {
        alert('No trades to export!');
        return;
    }

    const headers = ['Date', 'Symbol', 'Side', 'Quantity', 'Entry', 'Exit', 'P&L', 'Risk:Reward', 'Notes'];
    const rows = allTrades.map(trade => [
        trade.date.toISOString().split('T')[0],
        trade.symbol,
        trade.side,
        trade.quantity.toFixed(2),
        trade.entry ? trade.entry.toFixed(5) : '',
        trade.exit ? trade.exit.toFixed(5) : '',
        trade.pnl.toFixed(2),
        trade.riskReward ? trade.riskReward.toFixed(2) : '',
        trade.notes || ''
    ]);

    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
        csvContent += row.map(cell => {
            if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"') || cell.includes('\n'))) {
                return '"' + cell.replace(/"/g, '""') + '"';
            }
            return cell;
        }).join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const timestamp = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `tradezilla_export_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Utility: Format currency with color
 */
function getCurrencyDisplay(value) {
    if (value == null || isNaN(value)) {
        return { formatted: '--', colorClass: 'pnl-neutral' };
    }
    
    const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        signDisplay: 'auto'
    }).format(value);
    
    let colorClass = 'pnl-neutral';
    if (value > 0.001) colorClass = 'pnl-green';
    if (value < -0.001) colorClass = 'pnl-red';
    
    return { formatted, colorClass };
}',
                    bodyColor: '#F1F5F9',
                    borderColor: 'rgba(14, 165, 233, 0.5)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: (context) => `P&L: ${getCurrencyDisplay(context.parsed.y).formatted}`
                    }
                }
            }
        }
    });
}

/**
 * Update win/loss pie chart
 */
function updateWinLossChart(wins, losses) {
    const ctx = document.getElementById('winLossChart').getContext('2d');
    
    if (winLossChartInstance) {
        winLossChartInstance.destroy();
    }

    winLossChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Wins', 'Losses'],
            datasets: [{
                data: [wins, losses],
                backgroundColor: [
                    'rgba(34, 197, 94, 0.8)',
                    'rgba(239, 68, 68, 0.8)'
                ],
                borderColor: [
                    '#22C55E',
                    '#EF4444'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#F1F5F9',
                        padding: 20,
                        font: {
                            size: 14,
                            weight: '600'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#F1F5F9',
                    bodyColor: '#F1F5F9',
                    borderColor: 'rgba(14, 165, 233, 0.5)',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: (context) => {
                            const total = wins + losses;
                            const percent = ((context.parsed / total) * 100).toFixed(1);
                            return `${context.label}: ${context.parsed} (${percent}%)`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Update symbol performance bars
 */
function updateSymbolPerformance() {
    const symbolStats = {};
    
    allTrades.forEach(trade => {
        if (!symbolStats[trade.symbol]) {
            symbolStats[trade.symbol] = 0;
        }
        symbolStats[trade.symbol] += trade.pnl;
    });
    
    const sortedSymbols = Object.entries(symbolStats)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .slice(0, 5);
    
    const maxPnl = Math.max(...sortedSymbols.map(s => Math.abs(s[1])));
    
    const html = sortedSymbols.map(([symbol, pnl]) => {
        const pnlDisplay = getCurrencyDisplay(pnl);
        const widthPercent = (Math.abs(pnl) / maxPnl) * 100;
        
        return `
            <div class="symbol-bar">
                <div class="symbol-name">${symbol}</div>
                <div class="symbol-bar-fill">
                    <div class="symbol-bar-inner" style="width: ${widthPercent}%; background: ${pnl >= 0 ? 'linear-gradient(90deg, #22C55E, #10B981)' : 'linear-gradient(90deg, #EF4444, #DC2626)'}"></div>
                </div>
                <div class="symbol-value ${pnlDisplay.colorClass}">${pnlDisplay.formatted}</div>
            </div>
        `;
    }).join('');
    
    document.getElementById('symbolPerformance').innerHTML = html || '<p class="text-center text-slate-500 py-8">No data available</p>';
}

/**
 * Update day of week performance chart
 */
function updateDayChart() {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayStats = Array(7).fill(0);
    
    allTrades.forEach(trade => {
        const day = trade.date.getDay();
        dayStats[day] += trade.pnl;
    });
    
    const ctx = document.getElementById('dayChart').getContext('2d');
    
    if (dayChartInstance) {
        dayChartInstance.destroy();
    }

    dayChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dayNames,
            datasets: [{
                label: 'P&L by Day',
                data: dayStats,
                backgroundColor: dayStats.map(v => v >= 0 ? 'rgba(34, 197, 94, 0.6)' : 'rgba(239, 68, 68, 0.6)'),
                borderColor: dayStats.map(v => v >= 0 ? '#22C55E' : '#EF4444'),
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#94A3B8',
                        font: {
                            size: 11
                        }
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(148, 163, 184, 0.1)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#94A3B8',
                        callback: (value) => `$${value}`
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#F1F5F9