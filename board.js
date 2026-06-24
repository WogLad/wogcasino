/**
 * Roulette Betting Board Controller
 * Manages grid rendering, split/corner hover highlights, and chip placements.
 */

class RouletteBoard {
  constructor(containerId, onBetPlaced) {
    this.container = document.getElementById(containerId);
    this.onBetPlaced = onBetPlaced;
    this.activeBets = new Map(); // Key: zoneKey, Value: { betType, numbers, amount, chips, element }
    this.selectedChipValue = 5; // Default chip selection
    
    // Grid numbers mapping
    this.rows = [
      [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36], // Row 1 (Top)
      [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35], // Row 2 (Middle)
      [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34]  // Row 3 (Bottom)
    ];

    // Colors mapping
    this.redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

    this.renderBoard();
  }

  /**
   * Helper to determine number color
   */
  getNumberColor(num) {
    if (num === 0) return 'green';
    return this.redNumbers.includes(num) ? 'red' : 'black';
  }

  /**
   * Generates the board HTML and wires up event delegation
   */
  renderBoard() {
    this.container.innerHTML = '';
    
    const boardWrapper = document.createElement('div');
    boardWrapper.className = 'roulette-board-wrapper';

    // 1. Grid container
    const mainGrid = document.createElement('div');
    mainGrid.className = 'roulette-main-grid';

    // 0 Slot (Spans 3 rows)
    const zeroCell = document.createElement('div');
    zeroCell.className = 'board-cell zero-cell green';
    zeroCell.setAttribute('data-num', '0');
    
    const zeroLabel = document.createElement('span');
    zeroLabel.innerText = '0';
    zeroCell.appendChild(zeroLabel);

    // Create 0 straight bet zone
    this.addBetZone(zeroCell, 'straight', [0], 'straight-0');

    // Create 0 splits on the right edge of zero matching 1, 2, 3
    const split01 = document.createElement('div');
    split01.className = 'bet-zone split-zero-row';
    split01.style.top = '66%'; // bottom row
    split01.setAttribute('data-key', 'split-0-1');
    split01.setAttribute('data-nums', '0,1');
    split01.setAttribute('data-type', 'split');
    zeroCell.appendChild(split01);

    const split02 = document.createElement('div');
    split02.className = 'bet-zone split-zero-row';
    split02.style.top = '33%'; // middle row
    split02.setAttribute('data-key', 'split-0-2');
    split02.setAttribute('data-nums', '0,2');
    split02.setAttribute('data-type', 'split');
    zeroCell.appendChild(split02);

    const split03 = document.createElement('div');
    split03.className = 'bet-zone split-zero-row';
    split03.style.top = '0%'; // top row
    split03.setAttribute('data-key', 'split-0-3');
    split03.setAttribute('data-nums', '0,3');
    split03.setAttribute('data-type', 'split');
    zeroCell.appendChild(split03);

    mainGrid.appendChild(zeroCell);

    // Columns of numbers (c is 0 to 11)
    const numbersContainer = document.createElement('div');
    numbersContainer.className = 'board-numbers-container';

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 12; c++) {
        const num = this.rows[r][c];
        const color = this.getNumberColor(num);
        
        const cell = document.createElement('div');
        cell.className = `board-cell number-cell ${color}`;
        cell.setAttribute('data-num', num);
        
        const numLabel = document.createElement('span');
        numLabel.innerText = num;
        cell.appendChild(numLabel);

        // A. Straight bet on this cell
        this.addBetZone(cell, 'straight', [num], `straight-${num}`);

        // B. Split Right (horizontal connection to column + 1)
        if (c < 11) {
          const rightNum = this.rows[r][c + 1];
          const splitRightZone = document.createElement('div');
          splitRightZone.className = 'bet-zone split-right';
          splitRightZone.setAttribute('data-key', `split-${Math.min(num, rightNum)}-${Math.max(num, rightNum)}`);
          splitRightZone.setAttribute('data-nums', `${num},${rightNum}`);
          splitRightZone.setAttribute('data-type', 'split');
          cell.appendChild(splitRightZone);
        }

        // C. Split Bottom (vertical connection to row below)
        if (r < 2) {
          const bottomNum = this.rows[r + 1][c];
          const splitBottomZone = document.createElement('div');
          splitBottomZone.className = 'bet-zone split-bottom';
          splitBottomZone.setAttribute('data-key', `split-${Math.min(num, bottomNum)}-${Math.max(num, bottomNum)}`);
          splitBottomZone.setAttribute('data-nums', `${num},${bottomNum}`);
          splitBottomZone.setAttribute('data-type', 'split');
          cell.appendChild(splitBottomZone);
        }

        // D. Corner (intersection of 4 cells: right and bottom)
        if (r < 2 && c < 11) {
          const bottomNum = this.rows[r + 1][c];
          const rightNum = this.rows[r][c + 1];
          const cornerNum = this.rows[r + 1][c + 1];
          const cornerNums = [num, bottomNum, rightNum, cornerNum].sort((a,b)=>a-b);
          
          const cornerZone = document.createElement('div');
          cornerZone.className = 'bet-zone corner-point';
          cornerZone.setAttribute('data-key', `corner-${cornerNums.join('-')}`);
          cornerZone.setAttribute('data-nums', cornerNums.join(','));
          cornerZone.setAttribute('data-type', 'corner');
          cell.appendChild(cornerZone);
        }

        // E. Street Bet zone (on the bottom edge of row 3 cells)
        if (r === 2) {
          const colNums = [this.rows[0][c], this.rows[1][c], this.rows[2][c]].sort((a,b)=>a-b);
          const streetZone = document.createElement('div');
          streetZone.className = 'bet-zone street-bottom';
          streetZone.setAttribute('data-key', `street-${colNums.join('-')}`);
          streetZone.setAttribute('data-nums', colNums.join(','));
          streetZone.setAttribute('data-type', 'street');
          cell.appendChild(streetZone);

          // F. Line Bet zone (6 numbers, bottom right corner of row 3 cells)
          if (c < 11) {
            const nextColNums = [this.rows[0][c + 1], this.rows[1][c + 1], this.rows[2][c + 1]];
            const lineNums = [...colNums, ...nextColNums].sort((a,b)=>a-b);
            const lineZone = document.createElement('div');
            lineZone.className = 'bet-zone line-corner';
            lineZone.setAttribute('data-key', `line-${lineNums.join('-')}`);
            lineZone.setAttribute('data-nums', lineNums.join(','));
            lineZone.setAttribute('data-type', 'line');
            cell.appendChild(lineZone);
          }
        }

        numbersContainer.appendChild(cell);
      }
    }
    mainGrid.appendChild(numbersContainer);

    // 2-to-1 Column Bet slots on the far right
    const columnsContainer = document.createElement('div');
    columnsContainer.className = 'board-columns-container';
    for (let r = 0; r < 3; r++) {
      const colCell = document.createElement('div');
      colCell.className = 'board-cell column-bet-cell';
      colCell.innerHTML = '<span>2:1</span>';
      
      const colNums = this.rows[r]; // Entire row is the column bet
      this.addBetZone(colCell, 'column', colNums, `column-${r + 1}`);
      columnsContainer.appendChild(colCell);
    }
    mainGrid.appendChild(columnsContainer);
    boardWrapper.appendChild(mainGrid);

    // 2. Dozen containers below number grid
    const dozensContainer = document.createElement('div');
    dozensContainer.className = 'board-dozens-container';
    
    const dozens = [
      { label: '1st 12', nums: Array.from({length: 12}, (_, i) => i + 1) },
      { label: '2nd 12', nums: Array.from({length: 12}, (_, i) => i + 13) },
      { label: '3rd 12', nums: Array.from({length: 12}, (_, i) => i + 25) }
    ];

    dozens.forEach((doz, idx) => {
      const dozCell = document.createElement('div');
      dozCell.className = 'board-cell dozen-bet-cell';
      dozCell.innerHTML = `<span>${doz.label}</span>`;
      this.addBetZone(dozCell, 'dozen', doz.nums, `dozen-${idx + 1}`);
      dozensContainer.appendChild(dozCell);
    });
    boardWrapper.appendChild(dozensContainer);

    // 3. Outside bets container (Low/High, Red/Black, Even/Odd)
    const outsideContainer = document.createElement('div');
    outsideContainer.className = 'board-outside-container';

    const outsides = [
      { label: '1-18', type: 'low_high', nums: Array.from({length: 18}, (_, i) => i + 1), class: 'outside-text' },
      { label: 'EVEN', type: 'even_odd', nums: Array.from({length: 36}, (_, i) => i + 1).filter(n => n % 2 === 0), class: 'outside-text' },
      { label: 'RED', type: 'red_black', nums: this.redNumbers, class: 'outside-red red' },
      { label: 'BLACK', type: 'red_black', nums: Array.from({length: 36}, (_, i) => i + 1).filter(n => !this.redNumbers.includes(n)), class: 'outside-black black' },
      { label: 'ODD', type: 'even_odd', nums: Array.from({length: 36}, (_, i) => i + 1).filter(n => n % 2 !== 0), class: 'outside-text' },
      { label: '19-36', type: 'low_high', nums: Array.from({length: 18}, (_, i) => i + 19), class: 'outside-text' }
    ];

    outsides.forEach((out, idx) => {
      const outCell = document.createElement('div');
      outCell.className = `board-cell outside-bet-cell ${out.class}`;
      
      // Visual inner color block for Red/Black
      if (out.label === 'RED' || out.label === 'BLACK') {
        outCell.innerHTML = `<div class="color-diamond ${out.label.toLowerCase()}"></div>`;
      } else {
        outCell.innerHTML = `<span>${out.label}</span>`;
      }

      this.addBetZone(outCell, out.type, out.nums, `outside-${idx + 1}`);
      outsideContainer.appendChild(outCell);
    });
    boardWrapper.appendChild(outsideContainer);

    this.container.appendChild(boardWrapper);

    this.setupHoverHighlights();
    this.setupClickHandlers();
  }

  /**
   * Helper to attach data attributes to bet cells and zones
   */
  addBetZone(element, type, numbers, key) {
    element.classList.add('bet-zone');
    element.setAttribute('data-type', type);
    element.setAttribute('data-nums', numbers.join(','));
    element.setAttribute('data-key', key);
  }

  /**
   * Setup hover triggers to illuminate relevant numbers
   */
  setupHoverHighlights() {
    this.container.addEventListener('mouseover', (e) => {
      const zone = e.target.closest('.bet-zone');
      if (!zone) return;

      const numsAttr = zone.getAttribute('data-nums');
      if (!numsAttr) return;

      const numbers = numsAttr.split(',').map(Number);
      
      // Highlight all matching cells on the board
      numbers.forEach(num => {
        const cell = this.container.querySelector(`.board-cell[data-num="${num}"]`);
        if (cell) cell.classList.add('board-highlight');
      });
    });

    this.container.addEventListener('mouseout', (e) => {
      const zone = e.target.closest('.bet-zone');
      if (!zone) return;

      // Clear all highlighted numbers
      const cells = this.container.querySelectorAll('.board-cell.board-highlight');
      cells.forEach(cell => cell.classList.remove('board-highlight'));
    });
  }

  /**
   * Listen for chip placements on clicking zones
   */
  setupClickHandlers() {
    this.container.addEventListener('click', (e) => {
      const zone = e.target.closest('.bet-zone');
      if (!zone) return;

      const key = zone.getAttribute('data-key');
      const type = zone.getAttribute('data-type');
      const numbers = zone.getAttribute('data-nums').split(',').map(Number);

      // Trigger callback to see if balance allows placing this chip
      if (this.onBetPlaced) {
        this.onBetPlaced(key, type, numbers, this.selectedChipValue);
      }
    });
  }

  /**
   * Sets active chip value for next placement
   */
  setChipValue(value) {
    this.selectedChipValue = value;
  }

  /**
   * Adds chip visuals to a target betting zone
   */
  placeChipVisual(key, amount) {
    const zone = this.container.querySelector(`.bet-zone[data-key="${key}"]`);
    if (!zone) return;

    let chipStack = zone.querySelector('.chip-stack-container');
    if (!chipStack) {
      chipStack = document.createElement('div');
      chipStack.className = 'chip-stack-container';
      zone.appendChild(chipStack);
    }

    // Refresh chip contents
    chipStack.innerHTML = '';
    
    // Choose chip class color based on size
    let chipColor = 'chip-5';
    if (amount >= 500) chipColor = 'chip-500';
    else if (amount >= 100) chipColor = 'chip-100';
    else if (amount >= 25) chipColor = 'chip-25';
    else if (amount >= 10) chipColor = 'chip-10';
    else if (amount >= 5) chipColor = 'chip-5';
    else chipColor = 'chip-1';

    const chip = document.createElement('div');
    chip.className = `board-chip ${chipColor}`;
    
    // Format text nicely (e.g. 1.2K instead of 1200 if very large)
    let displayVal = amount;
    if (amount >= 1000) {
      displayVal = (amount / 1000).toFixed(1) + 'K';
    }
    
    chip.innerHTML = `<span>${displayVal}</span>`;
    chipStack.appendChild(chip);

    // Play quick sound effect
    if (typeof window.audioEngine !== 'undefined') {
      window.audioEngine.playChipClick();
    }
  }

  /**
   * Clears chip visual elements from board
   */
  clearAllChips() {
    const stacks = this.container.querySelectorAll('.chip-stack-container');
    stacks.forEach(st => st.remove());
    this.activeBets.clear();
  }

  /**
   * Highlight the winning number and cells
   * @param {number} winningNumber
   */
  highlightWinningNumber(winningNumber) {
    // Pulse winning cell on board
    const cell = this.container.querySelector(`.board-cell[data-num="${winningNumber}"]`);
    if (cell) {
      cell.classList.add('winning-cell-glow');
    }
  }

  /**
   * Reset winning highlight
   */
  clearWinningHighlight() {
    const cells = this.container.querySelectorAll('.winning-cell-glow');
    cells.forEach(c => c.classList.remove('winning-cell-glow'));
  }
}

window.RouletteBoard = RouletteBoard;
