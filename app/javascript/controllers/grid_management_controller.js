import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = {
    gridWidth: Number,
    gridHeight: Number,
    mode: String
  }

  connect() {
    console.log("Grid Management Controller connected")
  }

  // Generate an empty grid with default dimensions
  generateEmptyGrid() {
    const height = this.gridHeightValue || 15
    const width = this.gridWidthValue || 15
    return Array(height).fill().map(() => Array(width).fill(null))
  }

  // Get DOM element for specific cell
  getCellElement(row, col) {
    return this.element.querySelector(`.crossword-cell[data-row="${row}"][data-col="${col}"]`)
  }

  // Check if position is within grid bounds
  isValidPosition(row, col) {
    return row >= 0 && row < this.gridHeightValue && col >= 0 && col < this.gridWidthValue
  }

  // Check if cell is blocked (#)
  isCellBlocked(row, col, gridData) {
    if (!this.isValidPosition(row, col)) return true
    return gridData[row][col] === '#'
  }

  // Set value for a specific cell and update display
  setCellValue(row, col, value, gridData) {
    if (!this.isValidPosition(row, col)) return false

    gridData[row][col] = value || null
    
    // Clear error highlighting when a new letter is added
    const cell = this.getCellElement(row, col)
    if (cell) {
      cell.classList.remove('error')
    }
    
    this.updateCellDisplay(row, col, gridData)
    
    // Notify main controller that grid data changed with save info
    const event = new CustomEvent('grid-data-updated', {
      detail: { 
        gridData, 
        saveToServer: this.modeValue === 'play',
        row, 
        col, 
        value 
      },
      bubbles: true
    })
    this.element.dispatchEvent(event)

    return true
  }

  // Toggle block state of a cell
  toggleBlock(row, col, gridData) {
    if (!this.isValidPosition(row, col)) return false

    const currentValue = gridData[row][col]
    const newValue = currentValue === '#' ? null : '#'

    gridData[row][col] = newValue
    this.updateCellDisplay(row, col, gridData)
    
    // Notify main controller that grid data changed
    const event = new CustomEvent('grid-data-updated', {
      detail: { gridData, needsNumberingUpdate: this.modeValue === 'create' },
      bubbles: true
    })
    this.element.dispatchEvent(event)

    return true
  }

  // Update visual display of a single cell
  updateCellDisplay(row, col, gridData) {
    const cell = this.getCellElement(row, col)
    if (!cell) return

    const value = gridData[row][col]

    if (value === '#') {
      cell.classList.add('blocked')
      cell.innerHTML = ''
    } else {
      cell.classList.remove('blocked')
      
      // Preserve existing cell number if it exists
      const existingNumber = cell.querySelector('.cell-number')
      const numberHtml = existingNumber ? existingNumber.outerHTML : ''
      
      // Set the content with number preserved
      if (value) {
        cell.innerHTML = numberHtml + `<span class="cell-letter">${value}</span>`
      } else {
        cell.innerHTML = numberHtml
      }
    }
  }

  // Update display of entire grid
  updateGridDisplay(gridData) {
    for (let row = 0; row < gridData.length; row++) {
      for (let col = 0; col < gridData[row].length; col++) {
        this.updateCellDisplay(row, col, gridData)
      }
    }
    
    // Only update numbering in create mode, not play mode
    if (this.modeValue === 'create') {
      this.updateNumbering(gridData)
    }
  }

  // Update grid numbering (create mode only)
  updateNumbering(gridData) {
    // Calculate new numbering based on current grid state
    const numbering = this.calculateGridNumbering(gridData)
    
    // Clear all existing numbers
    this.element.querySelectorAll('.cell-number').forEach(el => el.remove())
    
    // Add new numbers
    Object.entries(numbering).forEach(([key, number]) => {
      const [row, col] = key.split(',').map(Number)
      const cell = this.getCellElement(row, col)
      if (cell && !cell.classList.contains('blocked')) {
        const numberSpan = document.createElement('span')
        numberSpan.className = 'cell-number'
        numberSpan.textContent = number
        cell.insertBefore(numberSpan, cell.firstChild)
      }
    })
  }

  // Calculate grid numbering based on word starts
  calculateGridNumbering(grid) {
    if (!grid || grid.length === 0) return {}
    
    const numbering = {}
    let currentNumber = 1
    const height = grid.length
    const width = grid[0]?.length || 0
    
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const cell = grid[row][col]
        // Only skip blocked cells (#), not empty cells (null/undefined)
        if (cell === '#') continue
        
        let shouldNumber = false
        
        // Check if this is the start of an across word
        if (this.startsAcrossWord(grid, row, col, width)) {
          shouldNumber = true
        }
        
        // Check if this is the start of a down word
        if (this.startsDownWord(grid, row, col, height)) {
          shouldNumber = true
        }
        
        if (shouldNumber) {
          numbering[[row, col]] = currentNumber
          currentNumber++
        }
      }
    }
    
    return numbering
  }

  // Check if position starts an across word
  startsAcrossWord(grid, row, col, width) {
    // Must not be a blocked cell (# is blocked, null/undefined are empty but available)
    if (grid[row][col] === '#') return false
    
    // Must be at left edge OR previous cell is blocked
    const leftIsBlocked = col === 0 || grid[row][col - 1] === '#'
    
    // Must have at least one more cell to the right that's not blocked
    const rightExists = col < width - 1 && grid[row][col + 1] !== '#'
    
    return leftIsBlocked && rightExists
  }

  // Check if position starts a down word
  startsDownWord(grid, row, col, height) {
    // Must not be a blocked cell (# is blocked, null/undefined are empty but available)
    if (grid[row][col] === '#') return false
    
    // Must be at top edge OR previous cell is blocked
    const topIsBlocked = row === 0 || grid[row - 1][col] === '#'
    
    // Must have at least one more cell below that's not blocked
    const bottomExists = row < height - 1 && grid[row + 1][col] !== '#'
    
    return topIsBlocked && bottomExists
  }

  // Clear entire grid
  clearGrid(gridData) {
    // Fill grid with null values
    for (let row = 0; row < gridData.length; row++) {
      for (let col = 0; col < gridData[row].length; col++) {
        gridData[row][col] = null
      }
    }
    
    this.updateGridDisplay(gridData)
    
    // Notify main controller that grid was cleared
    const event = new CustomEvent('grid-cleared', {
      detail: { gridData },
      bubbles: true
    })
    this.element.dispatchEvent(event)
  }

  // Reset puzzle grid - clear letters but preserve blocked cells
  resetPuzzleGrid(gridData) {
    // Clear only letter values, preserve blocks
    for (let row = 0; row < gridData.length; row++) {
      for (let col = 0; col < gridData[row].length; col++) {
        if (gridData[row][col] !== '#') {
          gridData[row][col] = null
        }
      }
    }
    
    this.updateGridDisplay(gridData)
    
    // Notify main controller that grid data was updated
    const event = new CustomEvent('grid-data-updated', {
      detail: { 
        gridData,
        needsNumberingUpdate: false,
        saveToServer: false
      },
      bubbles: true
    })
    this.element.dispatchEvent(event)
  }

  // Fill cells with answer for a word
  fillCellsWithAnswer(wordInfo, answer, gridData) {
    const positions = this.getWordPositions(wordInfo)
    
    positions.forEach((pos, index) => {
      if (index < answer.length && this.isValidPosition(pos.row, pos.col)) {
        this.setCellValue(pos.row, pos.col, answer[index], gridData)
      }
    })
  }

  // Clear cells of a word (only if not used by other words)
  clearCellsOfAnswer(wordInfo, gridData, appliedClues) {
    const positions = this.getWordPositions(wordInfo)
    const wordKey = `${wordInfo.startRow},${wordInfo.startCol},${wordInfo.direction}`
    
    positions.forEach(({row, col}) => {
      // Check if this position is part of any other applied clue
      if (!this.isPositionUsedByOtherClues(row, col, wordKey, appliedClues)) {
        this.setCellValue(row, col, '', gridData)
      }
    })
  }

  // Get all positions for a word
  getWordPositions(wordInfo) {
    const positions = []
    if (wordInfo.direction === 'across') {
      for (let i = 0; i < wordInfo.length; i++) {
        positions.push({
          row: wordInfo.startRow,
          col: wordInfo.startCol + i
        })
      }
    } else {
      for (let i = 0; i < wordInfo.length; i++) {
        positions.push({
          row: wordInfo.startRow + i,
          col: wordInfo.startCol
        })
      }
    }
    return positions
  }

  // Check if position is used by other applied clues
  isPositionUsedByOtherClues(row, col, excludeWordKey, appliedClues) {
    // Check if this position is covered by any other applied clue
    for (const [wordKey, appliedClue] of appliedClues.entries()) {
      if (wordKey === excludeWordKey) continue
      
      const positions = this.getWordPositions(appliedClue.wordInfo)
      const isUsed = positions.some(pos => pos.row === row && pos.col === col)
      if (isUsed) return true
    }
    return false
  }

  // Get current word information at position
  getCurrentWordInfo(row, col, direction, gridData) {
    const numbering = this.calculateGridNumbering(gridData)
    let wordInfo = null

    if (direction === 'across') {
      // Find start of current across word
      let startCol = col
      while (startCol > 0 && !this.isCellBlocked(row, startCol - 1, gridData)) {
        startCol--
      }

      // Find end of current across word
      let endCol = col
      while (endCol < this.gridWidthValue - 1 && !this.isCellBlocked(row, endCol + 1, gridData)) {
        endCol++
      }

      // Check if this word has a number (starts a word)
      const wordNumber = numbering[`${row},${startCol}`]
      if (wordNumber && endCol > startCol) {
        // Get current word pattern
        let pattern = ''
        for (let c = startCol; c <= endCol; c++) {
          const cellValue = gridData[row][c]
          pattern += (cellValue && cellValue !== '#') ? cellValue : '_'
        }

        wordInfo = {
          number: wordNumber,
          direction: 'across',
          startRow: row,
          startCol: startCol,
          length: endCol - startCol + 1,
          pattern: pattern
        }
      }
    } else {
      // Find start of current down word
      let startRow = row
      while (startRow > 0 && !this.isCellBlocked(startRow - 1, col, gridData)) {
        startRow--
      }

      // Find end of current down word
      let endRow = row
      while (endRow < this.gridHeightValue - 1 && !this.isCellBlocked(endRow + 1, col, gridData)) {
        endRow++
      }

      // Check if this word has a number (starts a word)
      const wordNumber = numbering[`${startRow},${col}`]
      if (wordNumber && endRow > startRow) {
        // Get current word pattern
        let pattern = ''
        for (let r = startRow; r <= endRow; r++) {
          const cellValue = gridData[r][col]
          pattern += (cellValue && cellValue !== '#') ? cellValue : '_'
        }

        wordInfo = {
          number: wordNumber,
          direction: 'down',
          startRow: startRow,
          startCol: col,
          length: endRow - startRow + 1,
          pattern: pattern
        }
      }
    }

    return wordInfo
  }

  // Initialize grid with data
  initializeGrid(gridData) {
    if (!gridData) {
      gridData = this.generateEmptyGrid()
    }
    
    this.updateGridDisplay(gridData)
    return gridData
  }

  // Public method to sync grid dimensions
  updateGridDimensions(width, height) {
    this.gridWidthValue = width
    this.gridHeightValue = height
  }
}
