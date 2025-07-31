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
    this.direction = 'across'
    this.highlightedCells = []
    this.usedClueIds = new Set() // Track used clue IDs to prevent duplicates
    this.appliedClues = new Map() // Track which clues are applied to which word positions
    this.initializeGrid()
    this.bindEvents()
    
    // Initialize the clues preview
    if (this.modeValue === 'create') {
      setTimeout(() => this.updateCluesPreview(), 100)
    }
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
        // Show matching clues for the current word
        this.updateCluesSuggestions(row, col)
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
    
    // Update clue suggestions for the new direction
    if (this.selectedRow !== undefined && this.selectedCol !== undefined) {
      this.updateCluesSuggestions(this.selectedRow, this.selectedCol)
    }
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
      
      // Clear all clue tracking
      this.usedClueIds.clear()
      this.appliedClues.clear()
      
      this.updateGridDisplay()
      this.updateGridData()
      
      // Clear the clue suggestions panel
      this.clearCluesSuggestions()
      
      // Update the clues preview
      this.updateCluesPreview()
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

  // Clue suggestion methods
  updateCluesSuggestions(row, col) {
    if (this.modeValue !== 'create' || this.isBlockMode) return

    const currentWord = this.getCurrentWordInfo(row, col)
    if (currentWord && currentWord.length >= 3) {
      this.fetchMatchingClues(currentWord)
    } else {
      this.clearCluesSuggestions()
    }
  }

  getCurrentWordInfo(row, col) {
    const numbering = this.calculateGridNumbering(this.gridData)
    let wordInfo = null

    if (this.direction === 'across') {
      // Find start of current across word
      let startCol = col
      while (startCol > 0 && !this.isCellBlocked(row, startCol - 1)) {
        startCol--
      }

      // Find end of current across word
      let endCol = col
      while (endCol < this.gridWidth - 1 && !this.isCellBlocked(row, endCol + 1)) {
        endCol++
      }

      // Check if this word has a number (starts a word)
      const wordNumber = numbering[`${row},${startCol}`]
      if (wordNumber && endCol > startCol) {
        // Get current word pattern
        let pattern = ''
        for (let c = startCol; c <= endCol; c++) {
          const cellValue = this.gridData[row][c]
          pattern += cellValue || '_'
        }

        wordInfo = {
          number: wordNumber,
          direction: 'across',
          length: endCol - startCol + 1,
          pattern: pattern,
          startRow: row,
          startCol: startCol
        }
      }
    } else {
      // Find start of current down word
      let startRow = row
      while (startRow > 0 && !this.isCellBlocked(startRow - 1, col)) {
        startRow--
      }

      // Find end of current down word
      let endRow = row
      while (endRow < this.gridHeight - 1 && !this.isCellBlocked(endRow + 1, col)) {
        endRow++
      }

      // Check if this word has a number (starts a word)
      const wordNumber = numbering[`${startRow},${col}`]
      if (wordNumber && endRow > startRow) {
        // Get current word pattern
        let pattern = ''
        for (let r = startRow; r <= endRow; r++) {
          const cellValue = this.gridData[r][col]
          pattern += cellValue || '_'
        }

        wordInfo = {
          number: wordNumber,
          direction: 'down',
          length: endRow - startRow + 1,
          pattern: pattern,
          startRow: startRow,
          startCol: col
        }
      }
    }

    return wordInfo
  }

  fetchMatchingClues(wordInfo) {
    const cluesPanel = this.element.querySelector('.clues-suggestions')
    if (!cluesPanel) return

    // Show loading state
    cluesPanel.innerHTML = `
      <div class="clues-header">
        <h4>Matching Clues</h4>
        <p>Word: ${wordInfo.number} ${wordInfo.direction} (${wordInfo.length} letters)</p>
        <p>Pattern: ${wordInfo.pattern.replace(/_/g, '□')}</p>
      </div>
      <div class="loading">Loading matching clues...</div>
    `

    // Get intersecting word constraints
    const intersectingConstraints = this.getIntersectingConstraints(wordInfo)

    // Fetch clues that match the pattern and don't conflict with intersecting words
    fetch('/clues/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content
      },
      body: JSON.stringify({
        length: wordInfo.length,
        pattern: wordInfo.pattern,
        intersecting_constraints: intersectingConstraints
      })
    })
    .then(response => response.json())
    .then(data => {
      this.displayCluesSuggestions(data, wordInfo)
    })
    .catch(error => {
      console.error('Error fetching clues:', error)
      cluesPanel.innerHTML = `
        <div class="clues-header">
          <h4>Matching Clues</h4>
          <p>Word: ${wordInfo.number} ${wordInfo.direction} (${wordInfo.length} letters)</p>
        </div>
        <div class="error">Error loading clues</div>
      `
    })
  }

  getIntersectingConstraints(wordInfo) {
    const constraints = []
    const positions = this.getWordPositions(wordInfo)

    console.log(`🎯 Getting intersecting constraints for ${wordInfo.direction} word at ${wordInfo.startRow},${wordInfo.startCol}`)
    console.log('📍 Word positions:', positions)

    positions.forEach((pos, index) => {
      // For each position in the current word, check if there are intersecting words
      // that would constrain what letter can go there
      const intersectingWordInfo = this.getIntersectingWordAt(pos.row, pos.col, wordInfo.direction)
      
      if (intersectingWordInfo && intersectingWordInfo.hasConstraints) {
        const constraint = {
          position: index, // Position within the current word (0-based)
          intersecting_direction: intersectingWordInfo.direction,
          intersecting_pattern: intersectingWordInfo.pattern,
          intersecting_position: intersectingWordInfo.intersectionPosition
        }
        constraints.push(constraint)
        console.log(`✓ Found constraint at position ${index}:`, constraint)
      } else {
        console.log(`○ No constraint at position ${index} (${pos.row},${pos.col})`)
      }
    })

    console.log('🔗 Final constraints:', constraints)
    return constraints
  }

  getIntersectingWordAt(row, col, currentDirection) {
    // Get the perpendicular direction
    const intersectingDirection = currentDirection === 'across' ? 'down' : 'across'
    
    let wordInfo = null
    const numbering = this.calculateGridNumbering(this.gridData)

    if (intersectingDirection === 'across') {
      // Find start of intersecting across word
      let startCol = col
      while (startCol > 0 && !this.isCellBlocked(row, startCol - 1)) {
        startCol--
      }

      // Find end of intersecting across word
      let endCol = col
      while (endCol < this.gridWidth - 1 && !this.isCellBlocked(row, endCol + 1)) {
        endCol++
      }

      // Check if this is a valid word (more than 1 letter)
      if (endCol > startCol) {
        let pattern = ''
        let hasConstraints = false
        
        for (let c = startCol; c <= endCol; c++) {
          const cellValue = this.gridData[row][c]
          if (cellValue && cellValue !== '#') {
            pattern += cellValue
            hasConstraints = true // Has existing letters
          } else {
            pattern += '_'
          }
        }

        // Even if no letters exist yet, this is still a constraint if it's a valid word slot
        // Check if this position would start a numbered word
        const wordNumber = numbering[`${row},${startCol}`]
        if (wordNumber || hasConstraints) {
          wordInfo = {
            direction: 'across',
            pattern: pattern,
            intersectionPosition: col - startCol, // This is the key fix - position within the intersecting word
            hasConstraints: hasConstraints || (endCol - startCol + 1) >= 3 // Constraint if it has letters OR is a valid word length
          }
          console.log(`🔍 Found intersecting across word at row ${row}, cols ${startCol}-${endCol}`)
          console.log(`   Pattern: "${pattern}", intersection at position ${col - startCol}`)
        }
      }
    } else {
      // Find start of intersecting down word
      let startRow = row
      while (startRow > 0 && !this.isCellBlocked(startRow - 1, col)) {
        startRow--
      }

      // Find end of intersecting down word
      let endRow = row
      while (endRow < this.gridHeight - 1 && !this.isCellBlocked(endRow + 1, col)) {
        endRow++
      }

      // Check if this is a valid word (more than 1 letter)
      if (endRow > startRow) {
        let pattern = ''
        let hasConstraints = false
        
        for (let r = startRow; r <= endRow; r++) {
          const cellValue = this.gridData[r][col]
          if (cellValue && cellValue !== '#') {
            pattern += cellValue
            hasConstraints = true // Has existing letters
          } else {
            pattern += '_'
          }
        }

        // Even if no letters exist yet, this is still a constraint if it's a valid word slot
        // Check if this position would start a numbered word
        const wordNumber = numbering[`${startRow},${col}`]
        if (wordNumber || hasConstraints) {
          wordInfo = {
            direction: 'down',
            pattern: pattern,
            intersectionPosition: row - startRow, // This is the key fix - position within the intersecting word
            hasConstraints: hasConstraints || (endRow - startRow + 1) >= 3 // Constraint if it has letters OR is a valid word length
          }
          console.log(`🔍 Found intersecting down word at col ${col}, rows ${startRow}-${endRow}`)
          console.log(`   Pattern: "${pattern}", intersection at position ${row - startRow}`)
        }
      }
    }

    return wordInfo
  }

  displayCluesSuggestions(clues, wordInfo) {
    const cluesPanel = this.element.querySelector('.clues-suggestions')
    if (!cluesPanel) return

    // Filter out clues that have already been used
    const availableClues = clues.filter(clue => !this.usedClueIds.has(clue.id.toString()))

    // Create a unique key for this word position
    const wordKey = `${wordInfo.startRow},${wordInfo.startCol},${wordInfo.direction}`
    const currentAppliedClue = this.appliedClues.get(wordKey)

    let html = `
      <div class="clues-header">
        <h4>Matching Clues</h4>
        <p>Word: ${wordInfo.number} ${wordInfo.direction} (${wordInfo.length} letters)</p>
        <p>Pattern: ${wordInfo.pattern.replace(/_/g, '□')}</p>
      </div>
    `

    // If there's already a clue applied to this word, show undo option
    if (currentAppliedClue) {
      html += `
        <div class="current-clue">
          <h5>Current Clue:</h5>
          <div class="clue-item applied">
            <div class="clue-text">${currentAppliedClue.clueText}</div>
            <div class="clue-answer">${currentAppliedClue.answer} (${currentAppliedClue.answer.length})</div>
          </div>
          <button class="btn btn-sm btn-outline-warning undo-clue-btn" data-word-key="${wordKey}">
            Undo This Clue
          </button>
        </div>
        <hr>
      `
    }

    if (availableClues.length === 0) {
      html += '<p class="no-clues">No unused matching clues found</p>'
    } else {
      html += '<div class="clues-list">'
      availableClues.forEach(clue => {
        let completionInfo = ''
        if (clue.completed_intersections && clue.completed_intersections.length > 0) {
          const completions = clue.completed_intersections.map(comp => 
            `${comp.number} ${comp.direction}: "${comp.clue_text}"`
          ).join(', ')
          completionInfo = `<div class="completion-info">✅ Will complete: ${completions}</div>`
        }
        
        html += `
          <div class="clue-item clickable" data-clue-id="${clue.id}" data-answer="${clue.answer}" data-completions='${JSON.stringify(clue.completed_intersections || [])}'>
            <div class="clue-text">${clue.clue_text}</div>
            <div class="clue-answer">${clue.answer} (${clue.answer.length})</div>
            ${completionInfo}
          </div>
        `
      })
      html += '</div>'
    }

    cluesPanel.innerHTML = html

    // Add event listeners for clickable clue items
    cluesPanel.querySelectorAll('.clue-item.clickable').forEach(item => {
      item.addEventListener('click', (e) => {
        const clueId = item.dataset.clueId
        const answer = item.dataset.answer
        const completions = JSON.parse(item.dataset.completions || '[]')
        this.useClueForCurrentWord(clueId, answer, wordInfo, completions)
      })
    })

    // Add event listener for undo button
    const undoBtn = cluesPanel.querySelector('.undo-clue-btn')
    if (undoBtn) {
      undoBtn.addEventListener('click', (e) => {
        const wordKey = e.target.dataset.wordKey
        this.undoClueForWord(wordKey, wordInfo)
      })
    }
  }

  useClueForCurrentWord(clueId, answer, wordInfo, completions = []) {
    console.log('🎯 Applying clue:', answer, 'with completions:', completions)
    
    // Add this clue to the used clues set
    this.usedClueIds.add(clueId.toString())

    // Create a unique key for this word position
    const wordKey = `${wordInfo.startRow},${wordInfo.startCol},${wordInfo.direction}`
    
    // If there was already a clue applied to this word, remove it from used clues
    const previousClue = this.appliedClues.get(wordKey)
    if (previousClue) {
      this.usedClueIds.delete(previousClue.clueId.toString())
    }

    // Store the applied clue information
    this.appliedClues.set(wordKey, {
      clueId: clueId,
      clueText: this.element.querySelector(`[data-clue-id="${clueId}"] .clue-text`).textContent,
      answer: answer,
      wordInfo: { ...wordInfo }
    })

    // Fill in the answer in the grid
    if (wordInfo.direction === 'across') {
      for (let i = 0; i < answer.length; i++) {
        const col = wordInfo.startCol + i
        if (col < this.gridWidth) {
          this.setCellValue(wordInfo.startRow, col, answer[i])
        }
      }
    } else {
      for (let i = 0; i < answer.length; i++) {
        const row = wordInfo.startRow + i
        if (row < this.gridHeight) {
          this.setCellValue(row, wordInfo.startCol, answer[i])
        }
      }
    }

    // Process any completed intersections
    completions.forEach(completion => {
      console.log('🔗 Auto-applying completed intersection:', completion)
      
      // Mark this clue as used
      this.usedClueIds.add(completion.clue_id.toString())
      
      // Find the word info for this intersecting word
      const intersectingWordInfo = this.findWordInfoByNumber(completion.number, completion.direction)
      if (intersectingWordInfo) {
        const intersectingWordKey = `${intersectingWordInfo.startRow},${intersectingWordInfo.startCol},${intersectingWordInfo.direction}`
        
        // Store the applied clue information
        this.appliedClues.set(intersectingWordKey, {
          clueId: completion.clue_id,
          clueText: completion.clue_text,
          answer: completion.answer,
          wordInfo: { ...intersectingWordInfo },
          autoApplied: true // Mark as automatically applied
        })
        
        console.log('✅ Auto-applied clue for', completion.number, completion.direction, ':', completion.answer)
      }
    })

    // Save the clue association to the puzzle (if we have a puzzle ID)
    if (this.puzzleIdValue) {
      this.savePuzzleClue(clueId, wordInfo.number, wordInfo.direction)
    }
    
    // Refresh the clues suggestions to show the undo option
    this.displayCluesSuggestions([], wordInfo)
    
    // Update the clues preview
    this.updateCluesPreview()
  }

  findWordInfoByNumber(number, direction) {
    // Search through the grid to find the word with this number and direction
    for (let row = 0; row < this.gridHeight; row++) {
      for (let col = 0; col < this.gridWidth; col++) {
        const cell = this.getCell(row, col)
        if (cell && cell.dataset.number == number) {
          // Check if this cell starts a word in the specified direction
          const wordInfo = this.getWordInfoAt(row, col, direction)
          if (wordInfo && wordInfo.number == number && wordInfo.direction === direction) {
            return wordInfo
          }
        }
      }
    }
    return null
  }

  savePuzzleClue(clueId, number, direction) {
    fetch('/crossword_game/save_puzzle_clue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content
      },
      body: JSON.stringify({
        puzzle_id: this.puzzleIdValue,
        clue_id: clueId,
        number: number,
        direction: direction
      })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        console.log(`Saved clue ${clueId} for word ${number} ${direction}`)
      } else {
        console.error('Failed to save puzzle clue:', data.error)
      }
    })
    .catch(error => {
      console.error('Error saving puzzle clue:', error)
    })
  }

  undoClueForWord(wordKey, currentWordInfo) {
    const appliedClue = this.appliedClues.get(wordKey)
    if (!appliedClue) return

    // Remove the clue from used clues set
    this.usedClueIds.delete(appliedClue.clueId.toString())

    // Remove the clue from applied clues
    this.appliedClues.delete(wordKey)

    // Clear letters that are unique to this word (not part of intersecting words)
    const wordInfo = appliedClue.wordInfo
    const positions = this.getWordPositions(wordInfo)
    
    positions.forEach(({row, col}) => {
      // Check if this position is part of any other applied clue
      if (!this.isPositionUsedByOtherClues(row, col, wordKey)) {
        this.setCellValue(row, col, '')
      }
    })

    // Refresh the clues suggestions
    this.updateCluesSuggestions(currentWordInfo.startRow, currentWordInfo.startCol)
    
    // Update the clues preview
    this.updateCluesPreview()
  }

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

  isPositionUsedByOtherClues(row, col, excludeWordKey) {
    // Check if this position is covered by any other applied clue
    for (const [wordKey, appliedClue] of this.appliedClues.entries()) {
      if (wordKey === excludeWordKey) continue
      
      const positions = this.getWordPositions(appliedClue.wordInfo)
      const isUsed = positions.some(pos => pos.row === row && pos.col === col)
      if (isUsed) return true
    }
    return false
  }

  clearCluesSuggestions() {
    const cluesPanel = this.element.querySelector('.clues-suggestions')
    if (cluesPanel) {
      cluesPanel.innerHTML = '<p class="no-selection">Select a word to see matching clues</p>'
    }
  }

  updateCluesPreview() {
    const acrossList = this.element.querySelector('#across-clues-list')
    const downList = this.element.querySelector('#down-clues-list')
    
    if (!acrossList || !downList) return

    const acrossClues = []
    const downClues = []
    const numbering = this.calculateGridNumbering(this.gridData)

    // Collect all applied clues organized by number and direction
    for (const [wordKey, appliedClue] of this.appliedClues.entries()) {
      const wordInfo = appliedClue.wordInfo
      const wordNumber = numbering[`${wordInfo.startRow},${wordInfo.startCol}`]
      
      if (wordNumber) {
        const clueEntry = {
          number: wordNumber,
          clueText: appliedClue.clueText,
          answer: appliedClue.answer
        }
        
        if (wordInfo.direction === 'across') {
          acrossClues.push(clueEntry)
        } else {
          downClues.push(clueEntry)
        }
      }
    }

    // Sort by number
    acrossClues.sort((a, b) => a.number - b.number)
    downClues.sort((a, b) => a.number - b.number)

    // Update across clues
    if (acrossClues.length === 0) {
      acrossList.innerHTML = '<p class="no-clues-yet">No across clues yet</p>'
    } else {
      acrossList.innerHTML = acrossClues.map(clue => 
        `<div class="clue-entry">
          <span class="clue-number">${clue.number}.</span> ${clue.clueText}
        </div>`
      ).join('')
    }

    // Update down clues
    if (downClues.length === 0) {
      downList.innerHTML = '<p class="no-clues-yet">No down clues yet</p>'
    } else {
      downList.innerHTML = downClues.map(clue => 
        `<div class="clue-entry">
          <span class="clue-number">${clue.number}.</span> ${clue.clueText}
        </div>`
      ).join('')
    }
  }
}
