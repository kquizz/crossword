import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["grid"]
  static values = {
    mode: String,
    puzzleId: String,
    grid: Array
  }

  connect() {
    this.isBlockMode = false
    this.selectedCell = null
    this.zoomLevel = 1
    this.direction = 'across' // 'across' or 'down'
    this.highlightedCells = []
    this.initializeGrid()
    this.bindEvents()
  }

  initializeGrid() {
    const gridContainer = this.element.querySelector('.crossword-interactive-grid')
    if (gridContainer) {
      this.gridData = this.gridValue || this.generateEmptyGrid()
      // Get grid dimensions from data
      this.gridHeight = this.gridData.length
      this.gridWidth = this.gridData[0]?.length || 15

      // Set initial cell sizes based on grid dimensions
      this.applyZoom()
      this.updateGridDisplay()
    }
  }

  bindEvents() {
    // Keyboard navigation and input
    document.addEventListener('keydown', this.handleKeydown.bind(this))

    // Cell click events
    this.element.addEventListener('click', this.handleCellClick.bind(this))

    // Mode toggle button
    const toggleBtn = this.element.querySelector('#toggle-mode-btn')
    if (toggleBtn) {
      toggleBtn.addEventListener('click', this.toggleMode.bind(this))
    }

    // Clear grid button
    const clearBtn = this.element.querySelector('#clear-grid-btn')
    if (clearBtn) {
      clearBtn.addEventListener('click', this.clearGrid.bind(this))
    }

    // Zoom buttons
    const zoomInBtn = this.element.querySelector('#zoom-in-btn')
    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', this.zoomIn.bind(this))
    }

    const zoomOutBtn = this.element.querySelector('#zoom-out-btn')
    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', this.zoomOut.bind(this))
    }

    const resetZoomBtn = this.element.querySelector('#reset-zoom-btn')
    if (resetZoomBtn) {
      resetZoomBtn.addEventListener('click', this.resetZoom.bind(this))
    }
  }

  handleCellClick(event) {
    const cell = event.target.closest('.crossword-cell')
    if (!cell) return

    const row = parseInt(cell.dataset.row)
    const col = parseInt(cell.dataset.col)

    if (this.modeValue === 'create' && this.isBlockMode) {
      this.toggleBlock(row, col)
    } else {
      this.selectCell(row, col)
    }
  }

  selectCell(row, col) {
    // Remove previous selection and highlights
    if (this.selectedCell) {
      this.selectedCell.classList.remove('selected')
    }
    this.clearHighlights()

    // Select new cell
    const cell = this.getCellElement(row, col)
    if (cell && !cell.classList.contains('blocked')) {
      cell.classList.add('selected')
      cell.focus()
      this.selectedCell = cell
      this.selectedRow = row
      this.selectedCol = col

      // Only highlight and update direction in letter mode, not block mode
      if (!(this.modeValue === 'create' && this.isBlockMode)) {
        this.highlightCurrentWord(row, col)
        this.updateDirectionIndicator()
      }
    }
  }

  clearHighlights() {
    this.highlightedCells.forEach(cell => {
      cell.classList.remove('highlighted')
    })
    this.highlightedCells = []
  }

  highlightCurrentWord(row, col) {
    if (this.direction === 'across') {
      this.highlightAcrossWord(row, col)
    } else {
      this.highlightDownWord(row, col)
    }
  }

  highlightAcrossWord(row, col) {
    // Find start of word (leftmost non-blocked cell)
    let startCol = col
    while (startCol > 0 && !this.isCellBlocked(row, startCol - 1)) {
      startCol--
    }

    // Find end of word (rightmost non-blocked cell)
    let endCol = col
    while (endCol < this.gridWidth - 1 && !this.isCellBlocked(row, endCol + 1)) {
      endCol++
    }

    // Highlight the word (only if it's more than 1 letter)
    if (endCol > startCol) {
      for (let c = startCol; c <= endCol; c++) {
        const cell = this.getCellElement(row, c)
        if (cell && !cell.classList.contains('blocked')) {
          cell.classList.add('highlighted')
          this.highlightedCells.push(cell)
        }
      }
    }
  }

  highlightDownWord(row, col) {
    // Find start of word (topmost non-blocked cell)
    let startRow = row
    while (startRow > 0 && !this.isCellBlocked(startRow - 1, col)) {
      startRow--
    }

    // Find end of word (bottommost non-blocked cell)
    let endRow = row
    while (endRow < this.gridHeight - 1 && !this.isCellBlocked(endRow + 1, col)) {
      endRow++
    }

    // Highlight the word (only if it's more than 1 letter)
    if (endRow > startRow) {
      for (let r = startRow; r <= endRow; r++) {
        const cell = this.getCellElement(r, col)
        if (cell && !cell.classList.contains('blocked')) {
          cell.classList.add('highlighted')
          this.highlightedCells.push(cell)
        }
      }
    }
  }

  isCellBlocked(row, col) {
    if (!this.isValidPosition(row, col)) return true
    return this.gridData[row][col] === '#'
  }

  handleKeydown(event) {
    // Don't handle keydown if user is typing in a form field
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.tagName === 'SELECT') {
      return
    }

    if (!this.selectedCell) return

    const row = this.selectedRow
    const col = this.selectedCol

    // Check for modifier key combinations (only in letter mode)
    const isShiftModifier = event.shiftKey && (event.altKey || event.metaKey || event.ctrlKey)

    if (isShiftModifier && !(this.modeValue === 'create' && this.isBlockMode)) {
      event.preventDefault()
      this.moveToPreviousWord()
      return
    }

    // In block mode, only handle basic movement and block toggling
    if (this.modeValue === 'create' && this.isBlockMode) {
      switch(event.key) {
        case 'ArrowUp':
          event.preventDefault()
          this.moveSelection(row - 1, col)
          break
        case 'ArrowDown':
          event.preventDefault()
          this.moveSelection(row + 1, col)
          break
        case 'ArrowLeft':
          event.preventDefault()
          this.moveSelection(row, col - 1)
          break
        case 'ArrowRight':
          event.preventDefault()
          this.moveSelection(row, col + 1)
          break
        case ' ':
          event.preventDefault()
          this.toggleBlock(row, col)
          break
      }
      return
    }

    // Letter mode keyboard handling
    switch(event.key) {
      case 'Enter':
        event.preventDefault()
        this.toggleDirection()
        break
      case 'ArrowUp':
        event.preventDefault()
        this.direction = 'down'
        this.moveSelection(row - 1, col)
        break
      case 'ArrowDown':
        event.preventDefault()
        this.direction = 'down'
        this.moveSelection(row + 1, col)
        break
      case 'ArrowLeft':
        event.preventDefault()
        this.direction = 'across'
        this.moveSelection(row, col - 1)
        break
      case 'ArrowRight':
        event.preventDefault()
        this.direction = 'across'
        this.moveSelection(row, col + 1)
        break
      case 'Backspace':
      case 'Delete':
        event.preventDefault()
        this.setCellValue(row, col, '')
        this.moveInDirection(row, col, true) // Move backwards
        break
      case ' ':
        if (this.modeValue === 'create') {
          event.preventDefault()
          this.toggleBlock(row, col)
        } else {
          event.preventDefault()
          this.moveInDirection(row, col, false) // Move forward
        }
        break
      case 'Tab':
        event.preventDefault()
        if (event.shiftKey) {
          this.moveToPreviousWord()
        } else {
          this.moveToNextWord()
        }
        break
      default:
        if (event.key.match(/^[a-zA-Z]$/)) {
          event.preventDefault()
          this.setCellValue(row, col, event.key.toUpperCase())
          this.moveInDirection(row, col, false) // Move forward
        }
    }
  }

  toggleDirection() {
    // Don't toggle direction in block mode
    if (this.modeValue === 'create' && this.isBlockMode) {
      return
    }

    this.direction = this.direction === 'across' ? 'down' : 'across'
    this.clearHighlights()
    this.highlightCurrentWord(this.selectedRow, this.selectedCol)
    this.updateDirectionIndicator()
  }

  moveInDirection(row, col, backwards = false) {
    let nextRow = row
    let nextCol = col

    if (this.direction === 'across') {
      nextCol = backwards ? col - 1 : col + 1
    } else {
      nextRow = backwards ? row - 1 : row + 1
    }

    // Find next valid cell in direction
    while (this.isValidPosition(nextRow, nextCol) && this.isCellBlocked(nextRow, nextCol)) {
      if (this.direction === 'across') {
        nextCol = backwards ? nextCol - 1 : nextCol + 1
      } else {
        nextRow = backwards ? nextRow - 1 : nextRow + 1
      }
    }

    if (this.isValidPosition(nextRow, nextCol)) {
      this.selectCell(nextRow, nextCol)
    }
  }

  moveToNextWord() {
    // Implementation for moving to next word would go here
    // For now, just move in current direction until we hit a blocked cell
    const row = this.selectedRow
    const col = this.selectedCol

    if (this.direction === 'across') {
      // Find end of current word, then next word start
      let nextCol = col
      while (nextCol < this.gridWidth && !this.isCellBlocked(row, nextCol)) {
        nextCol++
      }
      while (nextCol < this.gridWidth && this.isCellBlocked(row, nextCol)) {
        nextCol++
      }
      if (nextCol < this.gridWidth) {
        this.selectCell(row, nextCol)
      }
    } else {
      // Find end of current word, then next word start
      let nextRow = row
      while (nextRow < this.gridHeight && !this.isCellBlocked(nextRow, col)) {
        nextRow++
      }
      while (nextRow < this.gridHeight && this.isCellBlocked(nextRow, col)) {
        nextRow++
      }
      if (nextRow < this.gridHeight) {
        this.selectCell(nextRow, col)
      }
    }
  }

  moveToPreviousWord() {
    // Move to the previous word in the current direction
    const row = this.selectedRow
    const col = this.selectedCol

    if (this.direction === 'across') {
      // Find start of current word, then previous word start
      let prevCol = col
      while (prevCol >= 0 && !this.isCellBlocked(row, prevCol)) {
        prevCol--
      }
      while (prevCol >= 0 && this.isCellBlocked(row, prevCol)) {
        prevCol--
      }
      if (prevCol >= 0) {
        // Now find the start of the previous word
        while (prevCol >= 0 && !this.isCellBlocked(row, prevCol)) {
          prevCol--
        }
        prevCol++ // Move back to the first non-blocked cell
        this.selectCell(row, prevCol)
      }
    } else {
      // Find start of current word, then previous word start
      let prevRow = row
      while (prevRow >= 0 && !this.isCellBlocked(prevRow, col)) {
        prevRow--
      }
      while (prevRow >= 0 && this.isCellBlocked(prevRow, col)) {
        prevRow--
      }
      if (prevRow >= 0) {
        // Now find the start of the previous word
        while (prevRow >= 0 && !this.isCellBlocked(prevRow, col)) {
          prevRow--
        }
        prevRow++ // Move back to the first non-blocked cell
        this.selectCell(prevRow, col)
      }
    }
  }

  moveSelection(newRow, newCol) {
    if (this.isValidPosition(newRow, newCol)) {
      this.selectCell(newRow, newCol)
    }
  }

  setCellValue(row, col, value) {
    if (!this.isValidPosition(row, col)) return

    this.gridData[row][col] = value || null
    this.updateCellDisplay(row, col)
    this.updateGridData()

    // If in play mode and puzzle exists, save to server
    if (this.modeValue === 'play' && this.puzzleIdValue) {
      this.saveCell(row, col, value)
    }
  }

  toggleBlock(row, col) {
    if (!this.isValidPosition(row, col)) return

    const currentValue = this.gridData[row][col]
    const newValue = currentValue === '#' ? null : '#'

    this.gridData[row][col] = newValue
    this.updateCellDisplay(row, col)
    this.updateGridData()
    
    // Recalculate numbering since blocking/unblocking affects word starts
    this.updateNumbering()
  }

  updateCellDisplay(row, col) {
    const cell = this.getCellElement(row, col)
    if (!cell) return

    const value = this.gridData[row][col]

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

  updateGridDisplay() {
    for (let row = 0; row < this.gridData.length; row++) {
      for (let col = 0; col < this.gridData[row].length; col++) {
        this.updateCellDisplay(row, col)
      }
    }
    // Update numbering after updating cell displays
    this.updateNumbering()
  }

  updateNumbering() {
    // Calculate new numbering based on current grid state
    const numbering = this.calculateGridNumbering(this.gridData)
    
    console.log('Grid data:', this.gridData)
    console.log('Calculated numbering:', numbering)
    
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
        console.log(`Added number ${number} to cell (${row}, ${col})`)
      }
    })
  }

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

  startsAcrossWord(grid, row, col, width) {
    // Must not be a blocked cell (# is blocked, null/undefined are empty but available)
    if (grid[row][col] === '#') return false
    
    // Must be at left edge OR previous cell is blocked
    const leftIsBlocked = col === 0 || grid[row][col - 1] === '#'
    
    // Must have at least one more cell to the right that's not blocked
    const rightExists = col < width - 1 && grid[row][col + 1] !== '#'
    
    return leftIsBlocked && rightExists
  }

  startsDownWord(grid, row, col, height) {
    // Must not be a blocked cell (# is blocked, null/undefined are empty but available)
    if (grid[row][col] === '#') return false
    
    // Must be at top edge OR previous cell is blocked
    const topIsBlocked = row === 0 || grid[row - 1][col] === '#'
    
    // Must have at least one more cell below that's not blocked
    const bottomExists = row < height - 1 && grid[row + 1][col] !== '#'
    
    return topIsBlocked && bottomExists
  }

  updateGridData() {
    const gridInput = document.getElementById('grid-data')
    if (gridInput) {
      gridInput.value = JSON.stringify(this.gridData)
    }
  }

  toggleMode() {
    this.isBlockMode = !this.isBlockMode

    // Clear highlights when entering block mode
    if (this.isBlockMode) {
      this.clearHighlights()
      // Also remove selected state since we can't select blocked cells in block mode
      if (this.selectedCell) {
        this.selectedCell.classList.remove('selected')
        this.selectedCell = null
      }
    }

    const toggleBtn = this.element.querySelector('#toggle-mode-btn')
    if (toggleBtn) {
      toggleBtn.textContent = this.isBlockMode ? 'Switch to Letter Mode' : 'Switch to Block Mode'
      toggleBtn.className = this.isBlockMode ?
        'btn btn-sm btn-outline-danger' :
        'btn btn-sm btn-outline-secondary'
    }
  }

  clearGrid() {
    if (confirm('Are you sure you want to clear the entire grid?')) {
      this.gridData = Array(this.gridHeight).fill().map(() => Array(this.gridWidth).fill(null))
      this.updateGridDisplay()
      this.updateGridData()
    }
  }

  zoomIn() {
    this.zoomLevel = Math.min(this.zoomLevel * 1.2, 3)
    this.applyZoom()
  }

  zoomOut() {
    this.zoomLevel = Math.max(this.zoomLevel / 1.2, 0.5)
    this.applyZoom()
  }

  resetZoom() {
    this.zoomLevel = 1
    this.applyZoom()
  }

  updateDirectionIndicator() {
    // Update direction display in the UI
    let directionIndicator = this.element.querySelector('.direction-indicator')
    if (!directionIndicator) {
      // Create direction indicator if it doesn't exist
      const gameControls = this.element.querySelector('.game-controls .mode-indicators')
      if (gameControls) {
        directionIndicator = document.createElement('span')
        directionIndicator.className = 'direction-indicator'
        gameControls.appendChild(directionIndicator)
      }
    }

    if (directionIndicator) {
      directionIndicator.textContent = `Direction: ${this.direction === 'across' ? 'Across →' : 'Down ↓'}`
      directionIndicator.className = `direction-indicator ${this.direction}`
    }
  }

  applyZoom() {
    const cells = this.element.querySelectorAll('.crossword-cell.interactive')
    const gridContainer = this.element.querySelector('.crossword-interactive-grid')

    if (cells.length > 0 && gridContainer) {
      // Calculate base size based on grid dimensions
      const baseSize = this.calculateBaseCellSize()
      const zoomedSize = Math.max(15, baseSize * this.zoomLevel)
      const fontSize = Math.max(0.6, (zoomedSize / 40)) + 'rem'

      cells.forEach(cell => {
        cell.style.minHeight = zoomedSize + 'px'
        cell.style.minWidth = zoomedSize + 'px'
        cell.style.fontSize = fontSize
      })

      // Set the grid container size to fit all cells
      const totalWidth = this.gridWidth * zoomedSize + (this.gridWidth + 1) * 1  // +1px for borders/gaps
      const totalHeight = this.gridHeight * zoomedSize + (this.gridHeight + 1) * 1
      
      gridContainer.style.width = totalWidth + 'px'
      gridContainer.style.height = totalHeight + 'px'

      // Don't override the gap - let CSS handle borders
      // gridContainer.style.gap = gap + 'px'
    }
  }

  calculateBaseCellSize() {
    // Calculate appropriate cell size based on grid dimensions and viewport
    const gridSize = Math.max(this.gridWidth, this.gridHeight)
    const viewportWidth = window.innerWidth * 0.85  // Leave some margin
    const viewportHeight = window.innerHeight * 0.6  // Account for header/controls
    
    // Calculate maximum cell size that fits the grid in viewport
    const maxCellWidth = Math.floor(viewportWidth / this.gridWidth)
    const maxCellHeight = Math.floor(viewportHeight / this.gridHeight)
    const maxCellSize = Math.min(maxCellWidth, maxCellHeight)
    
    // Set reasonable bounds
    return Math.max(15, Math.min(maxCellSize, 80))
  }

  saveCell(row, col, value) {
    fetch('/crossword_game/update_cell', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content
      },
      body: JSON.stringify({
        id: this.puzzleIdValue,
        row: row,
        col: col,
        value: value
      })
    })
    .then(response => response.json())
    .then(data => {
      if (!data.success) {
        console.error('Failed to save cell:', data.error)
      }
    })
    .catch(error => {
      console.error('Error saving cell:', error)
    })
  }

  getCellElement(row, col) {
    return this.element.querySelector(`[data-row="${row}"][data-col="${col}"]`)
  }

  isValidPosition(row, col) {
    return row >= 0 && row < this.gridHeight && col >= 0 && col < this.gridWidth
  }

  generateEmptyGrid() {
    // Default to 15x15 if no grid data is available
    const height = this.gridHeight || 15
    const width = this.gridWidth || 15
    return Array(height).fill().map(() => Array(width).fill(null))
  }
}
