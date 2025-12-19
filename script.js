document.addEventListener('DOMContentLoaded', () => {
    // Prevent default context menu and shortcuts to deter viewing source
    document.addEventListener('contextmenu', event => event.preventDefault());
    document.addEventListener('keydown', function(event) {
        // F12
        if (event.key === 'F12') {
            event.preventDefault();
        }
        // Ctrl+Shift+I/J/C
        if (event.ctrlKey && event.shiftKey && ['I','J','C','i','j','c'].includes(event.key)) {
            event.preventDefault();
        }
        // Meta(Cmd)+Option+I/J/C (Mac)
        if (event.metaKey && event.altKey && ['I','J','C','i','j','c'].includes(event.key)) {
            event.preventDefault();
        }
        // Ctrl+U or Meta+U
        if ((event.ctrlKey || event.metaKey) && (event.key === 'u' || event.key === 'U')) {
            event.preventDefault();
        }
    });

    // Initialize LeanCloud
    AV.init({
        appId: "F3hGyTJb4wrF7imat01yLkQl-gzGzoHsz",
        appKey: "NxgACPDYm35MwjshfKSvZ6x6",
        serverURLs: "https://f3hgytjb.lc-cn-n1-shared.com"
    });
    
    new NumberMaze();
});

class NumberMaze {
    constructor() {
        this.rows = 8;
        this.cols = 8;
        this.targetLength = 60; // Default medium
        
        this.grid = []; 
        this.currentStep = 0;
        this.maxNumber = 0;
        this.lastPos = null;
        this.activeCells = []; 
        
        this.boardEl = document.getElementById('game-board');
        this.statusEl = document.getElementById('status');
        this.restartBtn = document.getElementById('restart-btn');
        this.resetLevelBtn = document.getElementById('reset-level-btn');
        this.saveBtn = document.getElementById('save-btn');
        this.loadBtn = document.getElementById('load-btn');
        this.difficultySelect = document.getElementById('difficulty-select');
        
        // Modal elements
        this.loadModal = document.getElementById('load-modal');
        this.passwordModal = document.getElementById('password-modal');
        this.renameModal = document.getElementById('rename-modal');
        
        this.closeModalBtns = document.querySelectorAll('.close-modal');
        this.levelListEl = document.getElementById('level-list');
        
        // Modal inputs
        this.deletePasswordInput = document.getElementById('delete-password-input');
        this.renameNameInput = document.getElementById('rename-name-input');
        this.renamePasswordInput = document.getElementById('rename-password-input');
        
        // Action buttons
        this.confirmDeleteBtn = document.getElementById('confirm-delete-btn');
        this.cancelDeleteBtn = document.getElementById('cancel-delete-btn');
        this.confirmRenameBtn = document.getElementById('confirm-rename-btn');
        this.cancelRenameBtn = document.getElementById('cancel-rename-btn');
        
        // State for actions
        this.targetLevelId = null;
        this.targetLevelName = null;
        
        this.restartBtn.addEventListener('click', () => this.init());
        this.resetLevelBtn.addEventListener('click', () => this.resetLevel());
        this.saveBtn.addEventListener('click', () => this.saveLevel());
        this.loadBtn.addEventListener('click', () => this.openLoadModal());
        this.difficultySelect.addEventListener('change', () => this.init());
        
        // Modal events
        this.closeModalBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetId = e.target.dataset.target;
                if (targetId) {
                    document.getElementById(targetId).style.display = 'none';
                }
            });
        });
        
        window.addEventListener('click', (e) => {
            if (e.target === this.loadModal) this.loadModal.style.display = 'none';
            if (e.target === this.passwordModal) this.passwordModal.style.display = 'none';
            if (e.target === this.renameModal) this.renameModal.style.display = 'none';
        });
        
        // Action Listeners
        this.confirmDeleteBtn.addEventListener('click', () => this.executeDelete());
        this.cancelDeleteBtn.addEventListener('click', () => {
            this.passwordModal.style.display = 'none';
            this.deletePasswordInput.value = '';
        });
        
        this.confirmRenameBtn.addEventListener('click', () => this.executeRename());
        this.cancelRenameBtn.addEventListener('click', () => {
            this.renameModal.style.display = 'none';
            this.renameNameInput.value = '';
            this.renamePasswordInput.value = '';
        });

        this.clickTimer = null;
        this.ADMIN_PASSWORD = "admin"; // Hardcoded simple password
        
        this.init();
    }

    init() {
        this.setDifficulty();
        this.currentStep = 0;
        this.activeCells = [];
        this.lastPos = null;
        this.boardEl.style.pointerEvents = 'auto';
        this.generateLevel();
        this.render();
        this.updateStatus("请点击数字 1 开始游戏");
    }
    
    resetLevel() {
        if (!confirm("确定要重新开始本局游戏吗？所有进度将丢失。")) return;
        
        this.currentStep = 0;
        this.activeCells = [];
        this.lastPos = null;
        this.boardEl.style.pointerEvents = 'auto';
        
        // Reset grid user state
        for(let r=0; r<this.rows; r++) {
            for(let c=0; c<this.cols; c++) {
                let cell = this.grid[r][c];
                if (!cell.isHole) {
                    if (!cell.isAnchor) {
                        cell.userValue = null;
                        cell.isHidden = true;
                    }
                }
            }
        }
        
        this.render();
        this.updateStatus("请点击数字 1 开始游戏");
    }
    
    setDifficulty() {
        const diff = this.difficultySelect.value;
        // Increase canvas size significantly to allow irregular shapes (trim later)
        switch(diff) {
            case 'easy':
                this.rows = 10;
                this.cols = 10;
                this.targetLength = 40;
                break;
            case 'medium':
                this.rows = 12;
                this.cols = 12;
                this.targetLength = 60;
                break;
            case 'hard':
                this.rows = 15;
                this.cols = 15;
                this.targetLength = 100;
                break;
        }
    }

    generateLevel() {
        let success = false;
        while (!success) {
            // 1. Initialize Grid
            this.grid = Array(this.rows).fill().map(() => Array(this.cols).fill(null));
            let validCells = [];

            // 2. Create irregular shape (Holes)
            for(let r=0; r<this.rows; r++) {
                for(let c=0; c<this.cols; c++) {
                    // With larger canvas, we don't need random holes as much, 
                    // but we can add some to break up the "square" feeling of the start area if we want.
                    // Actually, let's keep it simple: assume all are valid initially,
                    // and rely on randomWalk + trim to create the shape.
                    
                    let holeProb = 0.05; // Low hole probability
                    
                    if (Math.random() < holeProb) {
                        this.grid[r][c] = { isHole: true, value: null, isHidden: false };
                    } else {
                        this.grid[r][c] = { isHole: false, value: 0, isHidden: false };
                        validCells.push({r, c});
                    }
                }
            }

            if (validCells.length < this.targetLength) continue; 

            // 3. Generate Path
            let bestPath = [];
            
            // Try more times to find a path with good aspect ratio
            for(let i=0; i<5000; i++) {
                let start = validCells[Math.floor(Math.random() * validCells.length)];
                let path = this.randomWalk(start, this.targetLength); 
                
                // We care about the shape of the path we will ACTUALLY use.
                // If path is longer than target, we will slice it later.
                // So let's evaluate the sliced version.
                let effectivePath = path;
                if (effectivePath.length > this.targetLength) {
                    effectivePath = effectivePath.slice(0, this.targetLength);
                }
                
                let ratio = this.getPathRatio(effectivePath);
                let density = this.getPathDensity(effectivePath);
                
                let bestRatio = this.getPathRatio(bestPath);
                let bestDensity = this.getPathDensity(bestPath);
                
                let isBetter = false;
                
                if (bestPath.length === 0) {
                    isBetter = true;
                } else {
                    // Priority 1: Reach target length
                    if (effectivePath.length > bestPath.length) {
                        // If current best is already target length, don't switch unless ratio is better
                        if (bestPath.length >= this.targetLength) {
                            if (ratio < bestRatio) isBetter = true;
                        } else {
                            // If current best is short, always take longer one
                            isBetter = true;
                        }
                    } 
                    // Priority 2: Improve Aspect Ratio (closer to 1.0 is better)
                    else if (effectivePath.length === bestPath.length) {
                        if (ratio < bestRatio) {
                            isBetter = true;
                        } else if (ratio === bestRatio) {
                            // Priority 3: Improve Density (avoid large empty spaces)
                            if (density > bestDensity) {
                                isBetter = true;
                            }
                        }
                    }
                    
                    // Special case: If both are valid length, and both have good ratio, prefer higher density
                    if (bestPath.length >= this.targetLength && effectivePath.length >= this.targetLength) {
                         const ratioThreshold = 1.3;
                         if (ratio <= ratioThreshold && bestRatio <= ratioThreshold) {
                             if (density > bestDensity) isBetter = true;
                         }
                    }
                }
                
                if (isBetter) {
                    bestPath = effectivePath;
                    // Break if we have a full-length path with good ratio (e.g., <= 1.3) AND high density (e.g., > 0.7)
                    if (bestPath.length >= this.targetLength && ratio <= 1.3 && density > 0.7) break; 
                }
            }
            
            // Check if we met target length requirement
            if (bestPath.length >= this.targetLength * 0.95) {
                // bestPath is already sliced/effectivePath from the loop above
                
                this.maxNumber = bestPath.length;
                
                // Mark everything as hole initially
                for(let r=0; r<this.rows; r++) {
                    for(let c=0; c<this.cols; c++) {
                        this.grid[r][c].isHole = true;
                        this.grid[r][c].value = null;
                    }
                }

                // Fill path numbers
                let consecutiveHidden = 0;
                let currentHideRate = 0.6 + Math.random() * 0.2;
                
                bestPath.forEach((pos, index) => {
                    let cell = this.grid[pos.r][pos.c];
                    cell.isHole = false;
                    cell.value = index + 1; 
                    cell.isPath = true;
                    cell.userValue = null; 
                    
                    let shouldHide = false;
                    
                    if (cell.value === 1 || cell.value === this.maxNumber) {
                        shouldHide = false; 
                    } else {
                        if (consecutiveHidden >= 5) {
                            shouldHide = false;
                        } else {
                            shouldHide = Math.random() < currentHideRate;
                        }
                    }
                    
                    if (shouldHide) {
                        cell.isAnchor = false; 
                        cell.isHidden = true; 
                        consecutiveHidden++;
                    } else {
                        cell.isAnchor = true; 
                        cell.isHidden = false;
                        consecutiveHidden = 0;
                    }
                });
                
                // Trim the grid to the bounding box of the generated path
                this.trimGrid();
                
                success = true;
            }
        }
    }
    
    getPathRatio(path) {
        if (path.length === 0) return 999;
        let minR = Infinity, maxR = -Infinity;
        let minC = Infinity, maxC = -Infinity;
        
        path.forEach(p => {
            if (p.r < minR) minR = p.r;
            if (p.r > maxR) maxR = p.r;
            if (p.c < minC) minC = p.c;
            if (p.c > maxC) maxC = p.c;
        });
        
        let h = maxR - minR + 1;
        let w = maxC - minC + 1;
        return Math.max(w, h) / Math.min(w, h);
    }

    getPathDensity(path) {
        if (path.length === 0) return 0;
        let minR = Infinity, maxR = -Infinity;
        let minC = Infinity, maxC = -Infinity;
        
        path.forEach(p => {
            if (p.r < minR) minR = p.r;
            if (p.r > maxR) maxR = p.r;
            if (p.c < minC) minC = p.c;
            if (p.c > maxC) maxC = p.c;
        });
        
        let h = maxR - minR + 1;
        let w = maxC - minC + 1;
        let area = h * w;
        return path.length / area;
    }

    trimGrid() {
        // Find bounding box
        let minR = this.rows, maxR = 0;
        let minC = this.cols, maxC = 0;
        let hasContent = false;
        
        for(let r=0; r<this.rows; r++) {
            for(let c=0; c<this.cols; c++) {
                if (!this.grid[r][c].isHole) {
                    if (r < minR) minR = r;
                    if (r > maxR) maxR = r;
                    if (c < minC) minC = c;
                    if (c > maxC) maxC = c;
                    hasContent = true;
                }
            }
        }
        
        if (!hasContent) return; // Should not happen
        
        // Extract new grid
        const newRows = maxR - minR + 1;
        const newCols = maxC - minC + 1;
        const newGrid = [];
        
        for(let r=0; r<newRows; r++) {
            let row = [];
            for(let c=0; c<newCols; c++) {
                row.push(this.grid[minR + r][minC + c]);
            }
            newGrid.push(row);
        }
        
        this.rows = newRows;
        this.cols = newCols;
        this.grid = newGrid;
    }

    randomWalk(start, targetLen) {
        let path = [{...start}];
        let seen = new Set([`${start.r},${start.c}`]);
        let curr = start;
        
        // DFS-like greedy walk with backtracking is better for long paths, 
        // but simple random walk with lookahead or heuristic might suffice for this grid size.
        // Let's improve random walk: prefer neighbors that have fewer free neighbors (Warnsdorff's rule heuristic)
        
        while(true) {
            let neighbors = [];
            for(let dr=-1; dr<=1; dr++) {
                for(let dc=-1; dc<=1; dc++) {
                    if(dr===0 && dc===0) continue;
                    let nr = curr.r+dr, nc = curr.c+dc;
                    if (nr>=0 && nr<this.rows && nc>=0 && nc<this.cols && 
                        !this.grid[nr][nc].isHole && !seen.has(`${nr},${nc}`)) {
                        neighbors.push({r: nr, c: nc});
                    }
                }
            }
            
            if (neighbors.length === 0) break;
            
            // Heuristic: Pick neighbor with fewest available next moves to extend path duration
            // This is computationally more expensive but better for coverage
            neighbors.sort((a, b) => {
                let aFree = this.countFreeNeighbors(a, seen);
                let bFree = this.countFreeNeighbors(b, seen);
                // Add some randomness to avoid getting stuck in same loops
                return (aFree - bFree) + (Math.random() - 0.5); 
            });

            // Pick top 1 or 2
            let next = neighbors[0];
            
            path.push(next);
            seen.add(`${next.r},${next.c}`);
            curr = next;
        }
        return path;
    }

    countFreeNeighbors(pos, seen) {
        let count = 0;
        for(let dr=-1; dr<=1; dr++) {
            for(let dc=-1; dc<=1; dc++) {
                if(dr===0 && dc===0) continue;
                let nr = pos.r+dr, nc = pos.c+dc;
                if (nr>=0 && nr<this.rows && nc>=0 && nc<this.cols && 
                    !this.grid[nr][nc].isHole && !seen.has(`${nr},${nc}`)) {
                    count++;
                }
            }
        }
        return count;
    }

    render() {
        this.boardEl.innerHTML = '';
        this.boardEl.style.gridTemplateColumns = `repeat(${this.cols}, 55px)`;
        
        for(let r=0; r<this.rows; r++) {
            for(let c=0; c<this.cols; c++) {
                let cellData = this.grid[r][c];
                let cellEl = document.createElement('div');
                cellEl.classList.add('cell');
                cellEl.dataset.r = r;
                cellEl.dataset.c = c;
                
                if (cellData.isHole) {
                    cellEl.classList.add('empty');
                } else {
                    // Show value logic
                    let showValue = false;
                    let val = null;
                    
                    if (cellData.isAnchor) {
                        // Anchor: Show if it's 1, max, or revealed/connected? 
                        // Actually anchors are visible only if connected OR if it's the start/end/some hint?
                        // User requirement: "不显示default的数字" (Don't show default numbers), 
                        // BUT "1" and "Max" are usually exceptions, and we need to see where to go?
                        // Actually, in "Hide Numbers" logic, we hide intermediate numbers.
                        // In "Adjacent Click" logic, we only reveal if clicked correctly.
                        
                        // Current logic:
                        // 1. If it's part of active path (value <= currentStep), it must be visible.
                        // 2. If it's a hidden intermediate number that hasn't been reached, it is hidden.
                        // 3. BUT, anchors are fixed numbers. If I haven't reached it, should I see it?
                        // Usually in Number Maze, you see the "target" numbers (anchors) to know where to go.
                        // Let's assume Anchors that are NOT hidden (by the hide logic) are visible.
                        // And Anchors that ARE hidden are... hidden.
                        
                        // Wait, previous logic was:
                        // if (!cellData.isHidden || cellData.value === 1 || cellData.value === this.maxNumber) ...
                        
                        // Let's stick to: visible if revealed (active) OR if it's an explicit "hint" anchor that is not hidden.
                        
                        if (cellData.value <= this.currentStep) {
                             showValue = true;
                             val = cellData.value;
                             cellEl.classList.add('active');
                             if (cellData.value === this.currentStep) {
                                 cellEl.classList.add('last-active');
                                 this.lastPos = {r, c};
                             }
                        } else {
                            // It is a future number.
                            if (!cellData.isHidden) {
                                showValue = true;
                                val = cellData.value;
                            } else {
                                // It is hidden.
                                showValue = true; // We put the number in DOM but hide it with CSS class if needed?
                                // No, if we want to hide it completely:
                                // cellEl.textContent = '';
                                // But if we want to support "click to reveal" (if it was that logic), we need it.
                                // Current logic: Anchors are goals. 
                                // "Hide middle numbers" means set isHidden=true.
                                // If isHidden is true, we don't show text.
                                showValue = false;
                            }
                        }
                    } else {
                        // User filled cell
                        if (cellData.userValue !== null) {
                            showValue = true;
                            val = cellData.userValue;
                            cellEl.classList.add('active');
                            if (cellData.userValue === this.currentStep) {
                                cellEl.classList.add('last-active');
                                this.lastPos = {r, c};
                            }
                        }
                    }

                    if (showValue && val !== null) {
                        cellEl.textContent = val;
                    }
                    
                    // Interaction
                    cellEl.addEventListener('click', (e) => this.handleCellClick(r, c, cellEl));
                    cellEl.addEventListener('dblclick', (e) => this.handleCellDblClick(r, c, cellEl));
                }
                
                this.boardEl.appendChild(cellEl);
            }
        }
    }
    
    // LeanCloud Methods
    async saveLevel() {
        const name = prompt("请输入关卡名称", `Level ${new Date().toLocaleTimeString()}`);
        if (!name) return;
        
        const Level = AV.Object.extend('Level');
        const level = new Level();
        
        // Serialize Grid: We only need holes, values, and anchors. User state is reset.
        const gridData = this.grid.map(row => 
            row.map(cell => ({
                isHole: cell.isHole,
                value: cell.value,
                isAnchor: cell.isAnchor,
                isHidden: cell.isHidden // Save the hidden state design
            }))
        );
        
        level.set('name', name);
        level.set('rows', this.rows);
        level.set('cols', this.cols);
        level.set('targetLength', this.targetLength);
        level.set('maxNumber', this.maxNumber);
        level.set('grid', gridData);
        level.set('difficulty', this.difficultySelect.value);
        
        try {
            await level.save();
            alert('关卡保存成功！');
        } catch (error) {
            console.error(error);
            alert('保存失败: ' + error.message);
        }
    }
    
    async openLoadModal() {
        this.loadModal.style.display = 'block';
        this.levelListEl.innerHTML = '加载中...';
        
        const query = new AV.Query('Level');
        query.descending('createdAt');
        query.limit(1000); // Increase limit to show more levels (default is 100, max is 1000)
        
        try {
            const results = await query.find();
            this.renderLevelList(results);
        } catch (error) {
            this.levelListEl.innerHTML = '加载失败: ' + error.message;
        }
    }
    
    closeLoadModal() {
        this.loadModal.style.display = 'none';
    }
    
    renderLevelList(levels) {
        this.levelListEl.innerHTML = '';
        if (levels.length === 0) {
            this.levelListEl.innerHTML = '暂无保存的关卡';
            return;
        }
        
        levels.forEach(level => {
            const item = document.createElement('div');
            item.className = 'level-item';
            
            const date = level.createdAt.toLocaleDateString() + ' ' + level.createdAt.toLocaleTimeString();
            item.innerHTML = `
                <div class="level-main">
                    <strong>${level.get('name')}</strong>
                    <div class="level-info">${level.get('difficulty') || 'Unknown'} - Max: ${level.get('maxNumber')} - ${date}</div>
                </div>
                <div class="level-actions">
                    <button class="level-btn btn-rename">重命名</button>
                    <button class="level-btn btn-delete">删除</button>
                </div>
            `;
            
            // Main click to load (exclude buttons)
            item.querySelector('.level-main').addEventListener('click', () => {
                this.loadLevelFromCloud(level);
                this.closeLoadModal();
            });

            // Rename button
            item.querySelector('.btn-rename').addEventListener('click', (e) => {
                e.stopPropagation();
                this.renameLevel(level);
            });

            // Delete button
            item.querySelector('.btn-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteLevel(level);
            });
            
            this.levelListEl.appendChild(item);
        });
    }

    showRenameModal(level) {
        this.targetLevelId = level.id;
        this.targetLevelName = level.get('name');
        
        this.renameNameInput.value = this.targetLevelName;
        this.renamePasswordInput.value = '';
        this.renameModal.style.display = 'block';
    }

    async executeRename() {
        const pwd = this.renamePasswordInput.value;
        const newName = this.renameNameInput.value;
        
        if (!pwd) {
            alert("请输入密码");
            return;
        }
        
        if (pwd !== this.ADMIN_PASSWORD) {
            alert("密码错误");
            return;
        }

        if (!newName) {
            alert("请输入关卡名称");
            return;
        }

        const level = AV.Object.createWithoutData('Level', this.targetLevelId);
        level.set('name', newName);
        
        try {
            await level.save();
            alert("重命名成功");
            this.renameModal.style.display = 'none';
            this.openLoadModal(); // Refresh list
        } catch (error) {
            alert("重命名失败: " + error.message);
        }
    }

    showDeleteModal(level) {
        this.targetLevelId = level.id;
        this.deletePasswordInput.value = '';
        this.passwordModal.style.display = 'block';
    }

    async executeDelete() {
        const pwd = this.deletePasswordInput.value;
        
        if (!pwd) {
            alert("请输入密码");
            return;
        }
        
        if (pwd !== this.ADMIN_PASSWORD) {
            alert("密码错误");
            return;
        }

        const level = AV.Object.createWithoutData('Level', this.targetLevelId);
        
        try {
            await level.destroy();
            alert("删除成功");
            this.passwordModal.style.display = 'none';
            this.openLoadModal(); // Refresh list
        } catch (error) {
            alert("删除失败: " + error.message);
        }
    }
    
    loadLevelFromCloud(levelObj) {
        if (!confirm(`确定要加载关卡 "${levelObj.get('name')}" 吗？当前进度将丢失。`)) return;
        
        this.rows = levelObj.get('rows');
        this.cols = levelObj.get('cols');
        this.targetLength = levelObj.get('targetLength');
        this.maxNumber = levelObj.get('maxNumber');
        const gridData = levelObj.get('grid');
        
        // Reconstruct Grid
        this.grid = [];
        for(let r=0; r<this.rows; r++) {
            let row = [];
            for(let c=0; c<this.cols; c++) {
                let data = gridData[r][c];
                row.push({
                    isHole: data.isHole,
                    value: data.value,
                    isAnchor: data.isAnchor,
                    isHidden: data.isHidden,
                    userValue: null // Reset user state
                });
            }
            this.grid.push(row);
        }
        
        // Reset Game State
        this.currentStep = 0;
        this.activeCells = [];
        this.lastPos = null;
        this.boardEl.style.pointerEvents = 'auto';
        
        // Update UI
        this.difficultySelect.value = levelObj.get('difficulty') || 'medium'; // Sync select if possible
        this.render();
        this.updateStatus(`已加载关卡: ${levelObj.get('name')}`);
    }

    handleCellDblClick(r, c, el) {
        if (this.clickTimer) {
            clearTimeout(this.clickTimer);
            this.clickTimer = null;
        }
        
        let cellData = this.grid[r][c];
        if (el.classList.contains('active')) {
            let clickedVal = cellData.isAnchor ? cellData.value : cellData.userValue;
            
            // If clicking a previous step, rewind IMMEDIATELY without confirmation
            if (clickedVal < this.currentStep) {
                while (this.currentStep > clickedVal) {
                    this.undoLastStep();
                }
            }
        }
    }

    handleCellClick(r, c, el) {
        // If clicking an active cell, do nothing (wait for double click for rewind)
        if (el.classList.contains('active')) {
            return;
        }
        
        let cellData = this.grid[r][c];
        let nextVal = this.currentStep + 1;
        
        // Start logic
        if (this.currentStep === 0) {
            if (cellData.isAnchor && cellData.value === 1) {
                this.activateCell(el, r, c, 1);
            } else {
                // Wrong number at start
                this.showError(el);
                this.updateStatus("必须从 1 开始！", true);
            }
            return;
        }
        
        // Continue logic
        if (this.isAdjacent(r, c, this.lastPos.r, this.lastPos.c)) {
            if (cellData.isAnchor) {
                // If it's an anchor (fixed number), it MUST match the next step
                if (cellData.value === nextVal) {
                    this.activateCell(el, r, c, nextVal);
                } else {
                    this.showError(el);
                    this.updateStatus(`错误：这个格子是 ${cellData.value}，你需要连到 ${nextVal}`, true);
                }
            } else {
                // If it's not an anchor (hidden/empty), player can fill it with nextVal
                // We DON'T check if it matches the generated path. Player makes their own path.
                cellData.userValue = nextVal;
                cellData.isHidden = false;
                el.textContent = nextVal;
                el.classList.remove('hidden-value');
                this.activateCell(el, r, c, nextVal);
            }
        } else {
            this.showError(el);
            this.updateStatus("只能连接相邻的格子！", true);
        }
    }
    
    activateCell(el, r, c, val) {
        el.classList.add('active');
        
        // Update previous last-active
        if (this.activeCells.length > 0) {
            this.activeCells[this.activeCells.length - 1].el.classList.remove('last-active');
        }
        
        el.classList.add('last-active');
        
        this.activeCells.push({el, r, c, val});
        this.lastPos = { r, c };
        this.currentStep = val;
        
        if (this.currentStep === this.maxNumber) {
            this.handleWin();
        } else {
            this.updateStatus(`当前: ${val} -> 请寻找 ${val + 1}`);
        }
    }
    
    handleWin() {
        this.boardEl.style.pointerEvents = 'none';
        this.updateStatus("🎉 恭喜你！成功通关！ 🎉");
        this.triggerCelebration();
        this.animatePath();
        // Removed alert as requested
    }
    
    animatePath() {
        // Collect all cells in order from 1 to maxNumber
        const cellsMap = new Map();
        Array.from(this.boardEl.children).forEach(cell => {
            if (!cell.classList.contains('empty') && !cell.classList.contains('hole')) {
                const val = parseInt(cell.textContent);
                if (!isNaN(val)) {
                    cellsMap.set(val, cell);
                }
            }
        });

        // Clear existing highlights just in case
        cellsMap.forEach(cell => cell.classList.remove('active', 'last-active'));
        
        // Animate one by one
        let current = 1;
        const animateStep = () => {
            if (current > this.maxNumber) return;
            
            const cell = cellsMap.get(current);
            if (cell) {
                // Ensure it's visible (should be already, but make sure style is applied)
                cell.classList.remove('hidden-value');
                cell.classList.add('active');
                
                // Add a temporary highlight effect
                cell.classList.add('path-highlight');
                
                // Remove highlight from previous one to create a "moving" effect? 
                // Or keep them all lit? User said "dynamically show path".
                // Let's keep them lit but maybe emphasize the current one being drawn.
                
                // Optional: scroll into view if needed (not needed for this game size usually)
            }
            
            current++;
            setTimeout(animateStep, 100); // 100ms per step
        };
        
        animateStep();
    }
    
    triggerCelebration() {
        const duration = 5 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 999 };

        const randomInRange = (min, max) => Math.random() * (max - min) + min;

        const interval = setInterval(function() {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);
            // since particles fall down, start a bit higher than random
            confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
            confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
        }, 250);
    }
    
    undoLastStep() {
        if (this.activeCells.length === 0) return;
        
        // Remove current
        let current = this.activeCells.pop();
        current.el.classList.remove('active', 'last-active');
        
        // If it was a user-filled cell (not anchor), reset it
        let cellData = this.grid[current.r][current.c];
        if (!cellData.isAnchor) {
            cellData.userValue = null;
            cellData.isHidden = true;
            current.el.textContent = '';
            current.el.classList.add('hidden-value');
        }
        
        if (this.activeCells.length > 0) {
            // Restore previous
            let prev = this.activeCells[this.activeCells.length - 1];
            prev.el.classList.add('last-active');
            this.lastPos = { r: prev.r, c: prev.c };
            this.currentStep = prev.val;
            this.updateStatus(`回退到: ${prev.val} -> 请寻找 ${prev.val + 1}`);
        } else {
            // Back to start
            this.lastPos = null;
            this.currentStep = 0;
            this.updateStatus("请点击数字 1 开始游戏");
        }
        
        this.boardEl.style.pointerEvents = 'auto';
    }

    isAdjacent(r1, c1, r2, c2) {
        let dr = Math.abs(r1 - r2);
        let dc = Math.abs(c1 - c2);
        return dr <= 1 && dc <= 1 && !(dr === 0 && dc === 0);
    }
    
    showError(el) {
        el.classList.add('error');
        setTimeout(() => el.classList.remove('error'), 400);
    }
    
    updateStatus(msg, isError = false) {
        this.statusEl.textContent = msg;
        this.statusEl.style.color = isError ? '#e74c3c' : '#e67e22';
    }
}
