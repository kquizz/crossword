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
    this.cluesData = null // Store clues data
    this.currentClue = null // Track current active clue
    this.initializeGrid()
    this.bindEvents()
    
    // Load clues data for play mode
    if (this.modeValue === 'play') {
      this.loadCluesData()
    }
    
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

      // Apply automatic sizing for optimal viewing
      this.applyZoom()
      this.updateGridDisplay()
    }
  }

  bindEvents() {
    // Keyboard navigation and input
    document.addEventListener('keydown', this.handleKeydown.bind(this))

    // Cell click events
    this.element.addEventListener('click', this.handleCellClick.bind(this))

    // Clue click events for play mode
    if (this.modeValue === 'play') {
      this.element.addEventListener('click', this.handleClueClick.bind(this))
    }

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

    // Play mode specific buttons
    if (this.modeValue === 'play') {
      const checkPuzzleBtn = this.element.querySelector('#check-puzzle-btn')
      if (checkPuzzleBtn) {
        checkPuzzleBtn.addEventListener('click', this.checkPuzzle.bind(this))
      }

      const checkWordBtn = this.element.querySelector('#check-word-btn')
      if (checkWordBtn) {
        checkWordBtn.addEventListener('click', this.checkWord.bind(this))
      }

      const revealLetterBtn = this.element.querySelector('#reveal-letter-btn')
      if (revealLetterBtn) {
        revealLetterBtn.addEventListener('click', this.revealLetter.bind(this))
      }

      const revealWordBtn = this.element.querySelector('#reveal-word-btn')
      if (revealWordBtn) {
        revealWordBtn.addEventListener('click', this.revealWord.bind(this))
      }

      const resetPuzzleBtn = this.element.querySelector('#reset-puzzle-btn')
      if (resetPuzzleBtn) {
        resetPuzzleBtn.addEventListener('click', this.resetPuzzle.bind(this))
      }
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
          
          // In play mode, check if we've completed a word and should auto-advance
          if (this.modeValue === 'play' && this.isWordComplete(row, col)) {
            this.moveToNextUnfilledWord()
          } else {
            this.moveInDirection(row, col, false) // Move forward normally
          }
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
    
    // Update clue highlighting for the new direction in play mode
    if (this.modeValue === 'play' && this.selectedRow !== undefined && this.selectedCol !== undefined) {
      this.updateCurrentClueFromPosition(this.selectedRow, this.selectedCol)
    }
    
    // Update clue suggestions for the new direction in create mode
    if (this.modeValue === 'create' && this.selectedRow !== undefined && this.selectedCol !== undefined) {
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

  // Check if the current word is completely filled after typing in a cell
  isWordComplete(row, col) {
    const wordBounds = this.getCurrentWordBounds(row, col)
    if (!wordBounds) return false

    // Check if all cells in the word are filled
    if (this.direction === 'across') {
      for (let c = wordBounds.startCol; c <= wordBounds.endCol; c++) {
        if (!this.gridData[row][c] || this.gridData[row][c] === '#') {
          return false
        }
      }
    } else {
      for (let r = wordBounds.startRow; r <= wordBounds.endRow; r++) {
        if (!this.gridData[r][col] || this.gridData[r][col] === '#') {
          return false
        }
      }
    }
    return true
  }

  // Get the bounds of the current word
  getCurrentWordBounds(row, col) {
    if (this.direction === 'across') {
      // Find start and end of across word
      let startCol = col
      while (startCol > 0 && !this.isCellBlocked(row, startCol - 1)) {
        startCol--
      }
      let endCol = col
      while (endCol < this.gridWidth - 1 && !this.isCellBlocked(row, endCol + 1)) {
        endCol++
      }
      
      // Only return bounds if it's a valid word (more than 1 letter)
      if (endCol > startCol) {
        return { startRow: row, endRow: row, startCol, endCol }
      }
    } else {
      // Find start and end of down word
      let startRow = row
      while (startRow > 0 && !this.isCellBlocked(startRow - 1, col)) {
        startRow--
      }
      let endRow = row
      while (endRow < this.gridHeight - 1 && !this.isCellBlocked(endRow + 1, col)) {
        endRow++
      }
      
      // Only return bounds if it's a valid word (more than 1 letter)
      if (endRow > startRow) {
        return { startRow, endRow, startCol: col, endCol: col }
      }
    }
    return null
  }

  // Move to the next unfilled word in the current direction, or switch directions
  moveToNextUnfilledWord() {
    const currentNumber = this.getCurrentWordNumber()
    if (!currentNumber) {
      // Fallback to normal movement if we can't determine word number
      this.moveInDirection(this.selectedRow, this.selectedCol, false)
      return
    }

    console.log(`Looking for next unfilled word after ${currentNumber} in ${this.direction} direction`)

    // First try to find the next unfilled word in the current direction
    const nextWordInDirection = this.findNextUnfilledWord(currentNumber, this.direction)
    if (nextWordInDirection) {
      console.log(`Found next unfilled word: ${nextWordInDirection.number} ${nextWordInDirection.direction}`)
      this.direction = nextWordInDirection.direction
      this.selectCell(nextWordInDirection.row, nextWordInDirection.col)
      return
    }

    console.log(`No unfilled words in ${this.direction}, switching directions`)

    // If no unfilled words in current direction, switch directions
    const oppositeDirection = this.direction === 'across' ? 'down' : 'across'
    const nextWordInOpposite = this.findNextUnfilledWord(0, oppositeDirection) // Start from beginning
    if (nextWordInOpposite) {
      console.log(`Found unfilled word in opposite direction: ${nextWordInOpposite.number} ${nextWordInOpposite.direction}`)
      const oldDirection = this.direction
      this.direction = nextWordInOpposite.direction
      console.log(`Direction switched from ${oldDirection} to ${this.direction}`)
      
      // Select the cell and force a clue update
      this.selectCell(nextWordInOpposite.row, nextWordInOpposite.col)
      
      // Force update the clue highlighting after direction change
      setTimeout(() => {
        this.updateCurrentClueFromPosition(nextWordInOpposite.row, nextWordInOpposite.col)
      }, 10)
      
      return
    }

    console.log('No unfilled words found, using normal movement')
    // If no unfilled words found anywhere, just move normally
    this.moveInDirection(this.selectedRow, this.selectedCol, false)
  }

  // Get the number of the current word
  getCurrentWordNumber() {
    const numbering = this.calculateGridNumbering(this.gridData)
    const wordBounds = this.getCurrentWordBounds(this.selectedRow, this.selectedCol)
    if (!wordBounds) return null

    // For both across and down, we want the starting position of the word
    const startKey = `${wordBounds.startRow},${wordBounds.startCol}`
    return numbering[startKey] || null
  }

  // Find the next unfilled word starting from a given number
  findNextUnfilledWord(startNumber, direction) {
    if (!this.cluesData || !this.cluesData[direction]) {
      return null
    }

    const clues = this.cluesData[direction]
    const sortedClues = [...clues].sort((a, b) => a.number - b.number)

    // First, try to find words with numbers higher than startNumber
    for (const clue of sortedClues) {
      if (clue.number > startNumber && !this.isClueWordComplete(clue)) {
        return { row: clue.row, col: clue.col, direction, number: clue.number }
      }
    }

    // If no higher numbers found, loop back to the beginning
    for (const clue of sortedClues) {
      if (clue.number <= startNumber && !this.isClueWordComplete(clue)) {
        return { row: clue.row, col: clue.col, direction, number: clue.number }
      }
    }

    return null
  }

  // Check if a specific clue's word is completely filled
  isClueWordComplete(clue) {
    if (clue.direction === 'across') {
      // Check across word
      for (let i = 0; i < clue.answer.length; i++) {
        const checkCol = clue.col + i
        if (checkCol >= this.gridWidth || !this.gridData[clue.row][checkCol]) {
          return false
        }
      }
    } else {
      // Check down word  
      for (let i = 0; i < clue.answer.length; i++) {
        const checkRow = clue.row + i
        if (checkRow >= this.gridHeight || !this.gridData[checkRow][clue.col]) {
          return false
        }
      }
    }
    return true
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
    
    // Clear error highlighting when a new letter is added
    const cell = this.getCellElement(row, col)
    if (cell) {
      cell.classList.remove('error')
    }
    
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
    // Only do this in create mode
    if (this.modeValue === 'create') {
      this.updateNumbering()
    }
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
    // Only update numbering in create mode, not play mode
    if (this.modeValue === 'create') {
      this.updateNumbering()
    }
  }

  updateNumbering() {
    // Don't update numbering in play mode - it should be fixed based on puzzle structure
    if (this.modeValue === 'play') {
      return
    }
    
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
    return this.element.querySelector(`.crossword-cell[data-row="${row}"][data-col="${col}"]`)
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
          intersecting_number: intersectingWordInfo.number,
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
    // Skip clues preview update in play mode - clues are server-rendered
    if (this.modeValue === 'play') return
    
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

  // New methods for play mode clue functionality
  loadCluesData() {
    // Load clues data from the grid element's data attribute
    const gridElement = this.element.querySelector('.crossword-interactive-grid')
    if (gridElement && gridElement.dataset.clues) {
      try {
        this.cluesData = JSON.parse(gridElement.dataset.clues)
      } catch (e) {
        console.error('Failed to parse clues data:', e)
        this.cluesData = { across: [], down: [] }
      }
    } else {
      this.cluesData = { across: [], down: [] }
    }
    
    // In play mode, also set up protection for server-rendered clues
    if (this.modeValue === 'play') {
      this.protectServerRenderedClues()
    }
  }

  protectServerRenderedClues() {
    const acrossList = this.element.querySelector('#across-clues-list')
    const downList = this.element.querySelector('#down-clues-list')
    
    if (acrossList && downList) {
      // Store original innerHTML to prevent it from being cleared
      const originalAcrossHTML = acrossList.innerHTML
      const originalDownHTML = downList.innerHTML
      
      // Override innerHTML setter to prevent clearing in play mode
      Object.defineProperty(acrossList, 'innerHTML', {
        get: function() { return this._innerHTML || originalAcrossHTML },
        set: function(value) {
          // Silently ignore attempts to change innerHTML in play mode
        }
      })
      
      Object.defineProperty(downList, 'innerHTML', {
        get: function() { return this._innerHTML || originalDownHTML },
        set: function(value) {
          // Silently ignore attempts to change innerHTML in play mode
        }
      })
    }
  }

  handleClueClick(event) {
    const clueItem = event.target.closest('.clue-item')
    if (!clueItem) return

    event.preventDefault()
    
    const direction = clueItem.dataset.direction
    const number = parseInt(clueItem.dataset.number)
    const row = parseInt(clueItem.dataset.row)
    const col = parseInt(clueItem.dataset.col)

    // Set direction and navigate to the clue's starting cell
    this.direction = direction
    this.selectCell(row, col)
    this.setActiveClue(clueItem, direction, number)
  }

  setActiveClue(clueItem, direction, number) {
    // Remove active class from all clue items
    this.element.querySelectorAll('.clue-item').forEach(item => {
      item.classList.remove('active')
    })

    // Add active class to clicked clue
    clueItem.classList.add('active')

    // Scroll the clue into view
    this.scrollClueIntoView(clueItem)

    // Update current clue display
    const clueText = clueItem.querySelector('.clue-text').textContent
    const clueLength = clueItem.querySelector('.clue-length').textContent
    
    this.updateCurrentClueDisplay(direction, number, clueText, clueLength)
    this.currentClue = { direction, number, clueText }
  }

  scrollClueIntoView(clueItem) {
    // Find the clues panel container
    const cluesPanel = clueItem.closest('.clues-panel')
    if (!cluesPanel) return

    // Get the bounds of the clue item and container
    const clueRect = clueItem.getBoundingClientRect()
    const panelRect = cluesPanel.getBoundingClientRect()

    // Check if the clue is outside the visible area
    const isAbove = clueRect.top < panelRect.top
    const isBelow = clueRect.bottom > panelRect.bottom

    if (isAbove || isBelow) {
      // Scroll the clue into view with some padding
      clueItem.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })
    }
  }

  updateCurrentClueDisplay(direction, number, clueText, clueLength) {
    const titleElement = this.element.querySelector('#current-clue-title')
    const textElement = this.element.querySelector('#current-clue-text')

    if (titleElement && textElement) {
      titleElement.textContent = `${number} ${direction.charAt(0).toUpperCase() + direction.slice(1)}`
      textElement.textContent = `${clueText} ${clueLength}`
    }
  }

  // Override selectCell to also update current clue when cells are clicked
  selectCell(row, col) {
    // Call the original selectCell logic
    if (this.selectedCell) {
      this.selectedCell.classList.remove('selected')
    }
    this.clearHighlights()

    const cell = this.getCellElement(row, col)
    if (cell && !cell.classList.contains('blocked')) {
      cell.classList.add('selected')
      cell.focus()
      this.selectedCell = cell
      this.selectedRow = row
      this.selectedCol = col

      if (!(this.modeValue === 'create' && this.isBlockMode)) {
        this.highlightCurrentWord(row, col)
        this.updateDirectionIndicator()
        
        // For play mode, update current clue display
        if (this.modeValue === 'play') {
          this.updateCurrentClueFromPosition(row, col)
        } else {
          // Show matching clues for the current word in create mode
          this.updateCluesSuggestions(row, col)
        }
      }
    }
  }

  updateCurrentClueFromPosition(row, col) {
    if (!this.cluesData) return

    // Find the clue that matches the current position and direction
    const clues = this.cluesData[this.direction] || []
    const matchingClue = clues.find(clue => {
      if (this.direction === 'across') {
        return clue.row === row && clue.col <= col && 
               col < clue.col + clue.answer.length
      } else {
        return clue.col === col && clue.row <= row && 
               row < clue.row + clue.answer.length
      }
    })

    if (matchingClue) {
      // Find and activate the corresponding clue item
      const clueItem = this.element.querySelector(
        `.clue-item[data-direction="${this.direction}"][data-number="${matchingClue.number}"]`
      )
      if (clueItem) {
        this.setActiveClue(clueItem, this.direction, matchingClue.number)
      }
    }
  }

  // Puzzle validation and hint methods
  checkPuzzle() {
    if (!this.cluesData || !this.element.querySelector('.crossword-interactive-grid')) return

    let hasErrors = false
    const allClues = [...this.cluesData.across, ...this.cluesData.down]

    allClues.forEach(clue => {
      const isCorrect = this.checkClueWord(clue, false) // Don't highlight, just check
      if (!isCorrect) {
        hasErrors = true
        this.highlightIncorrectClue(clue)
      }
    })

    if (!hasErrors) {
      this.checkForPuzzleCompletion()
    }
  }

  checkWord() {
    if (!this.selectedCell || !this.cluesData) return

    const currentClue = this.getCurrentClueFromPosition(this.selectedRow, this.selectedCol)
    if (currentClue) {
      const isCorrect = this.checkClueWord(currentClue, true)
      if (isCorrect) {
        this.showMessage('Word is correct! ✓', 'success')
      } else {
        this.showMessage('Word has errors ✗', 'error')
      }
    }
  }

  revealLetter() {
    if (!this.selectedCell || !this.cluesData) return

    const currentClue = this.getCurrentClueFromPosition(this.selectedRow, this.selectedCol)
    if (currentClue) {
      const letterIndex = this.getLetterIndexInWord(this.selectedRow, this.selectedCol, currentClue)
      if (letterIndex !== -1 && letterIndex < currentClue.answer.length) {
        const correctLetter = currentClue.answer[letterIndex]
        this.setCellValue(this.selectedRow, this.selectedCol, correctLetter)
        this.clearCellError(this.selectedRow, this.selectedCol)
        this.showMessage(`Revealed: ${correctLetter}`, 'info')
      }
    }
  }

  revealWord() {
    if (!this.selectedCell || !this.cluesData) return

    const currentClue = this.getCurrentClueFromPosition(this.selectedRow, this.selectedCol)
    if (currentClue) {
      if (confirm('Reveal the entire current word?')) {
        this.fillClueWord(currentClue)
        this.showMessage(`Revealed: ${currentClue.answer}`, 'info')
      }
    }
  }

  resetPuzzle() {
    if (confirm('Are you sure you want to reset the entire puzzle? All progress will be lost.')) {
      // Clear all cells locally first
      for (let row = 0; row < this.gridHeight; row++) {
        for (let col = 0; col < this.gridWidth; col++) {
          if (this.gridData[row][col] !== '#') {
            this.gridData[row][col] = null
            this.updateCellDisplay(row, col)
            this.clearCellError(row, col)
          }
        }
      }
      
      // If in play mode, send a bulk reset request to the server
      if (this.modeValue === 'play' && this.puzzleIdValue) {
        this.resetPuzzleOnServer()
      }
      
      this.showMessage('Puzzle reset!', 'info')
    }
  }

  resetPuzzleOnServer() {
    fetch('/crossword_game/reset_puzzle', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content
      },
      body: JSON.stringify({
        id: this.puzzleIdValue
      })
    })
    .then(response => response.json())
    .then(data => {
      if (!data.success) {
        console.error('Failed to reset puzzle:', data.error)
        this.showMessage('Error resetting puzzle on server', 'error')
      }
    })
    .catch(error => {
      console.error('Error resetting puzzle:', error)
      this.showMessage('Error resetting puzzle on server', 'error')
    })
  }

  // Helper methods
  checkClueWord(clue, highlightErrors = true) {
    let isCorrect = true
    
    for (let i = 0; i < clue.answer.length; i++) {
      let checkRow, checkCol
      if (clue.direction === 'across') {
        checkRow = clue.row
        checkCol = clue.col + i
      } else {
        checkRow = clue.row + i
        checkCol = clue.col
      }

      const userValue = this.gridData[checkRow][checkCol]
      const correctValue = clue.answer[i]

      if (userValue !== correctValue) {
        isCorrect = false
        if (highlightErrors && userValue) { // Only highlight if there's a user value
          this.setCellError(checkRow, checkCol)
        }
      } else if (userValue === correctValue) {
        // Clear error if the letter is now correct
        this.clearCellError(checkRow, checkCol)
      }
    }

    return isCorrect
  }

  highlightIncorrectClue(clue) {
    for (let i = 0; i < clue.answer.length; i++) {
      let checkRow, checkCol
      if (clue.direction === 'across') {
        checkRow = clue.row
        checkCol = clue.col + i
      } else {
        checkRow = clue.row + i
        checkCol = clue.col
      }

      const userValue = this.gridData[checkRow][checkCol]
      const correctValue = clue.answer[i]

      if (userValue && userValue !== correctValue) {
        this.setCellError(checkRow, checkCol)
      }
    }
  }

  fillClueWord(clue) {
    for (let i = 0; i < clue.answer.length; i++) {
      let fillRow, fillCol
      if (clue.direction === 'across') {
        fillRow = clue.row
        fillCol = clue.col + i
      } else {
        fillRow = clue.row + i
        fillCol = clue.col
      }

      this.setCellValue(fillRow, fillCol, clue.answer[i])
      this.clearCellError(fillRow, fillCol)
    }
  }

  getCurrentClueFromPosition(row, col) {
    if (!this.cluesData) return null

    const clues = this.cluesData[this.direction] || []
    return clues.find(clue => {
      if (this.direction === 'across') {
        return clue.row === row && clue.col <= col && col < clue.col + clue.answer.length
      } else {
        return clue.col === col && clue.row <= row && row < clue.row + clue.answer.length
      }
    })
  }

  getLetterIndexInWord(row, col, clue) {
    if (clue.direction === 'across') {
      return col - clue.col
    } else {
      return row - clue.row
    }
  }

  setCellError(row, col) {
    const cell = this.getCellElement(row, col)
    if (cell) {
      cell.classList.add('error')
    }
  }

  clearCellError(row, col) {
    const cell = this.getCellElement(row, col)
    if (cell) {
      cell.classList.remove('error')
    }
  }

  checkForPuzzleCompletion() {
    if (!this.cluesData) return

    const allClues = [...this.cluesData.across, ...this.cluesData.down]
    const allCorrect = allClues.every(clue => {
      for (let i = 0; i < clue.answer.length; i++) {
        let checkRow, checkCol
        if (clue.direction === 'across') {
          checkRow = clue.row
          checkCol = clue.col + i
        } else {
          checkRow = clue.row + i
          checkCol = clue.col
        }
        
        if (this.gridData[checkRow][checkCol] !== clue.answer[i]) {
          return false
        }
      }
      return true
    })

    if (allCorrect) {
      this.showPuzzleCompletedMessage()
    }
  }

  showPuzzleCompletedMessage() {
    const message = document.createElement('div')
    message.className = 'puzzle-completed-message'
    message.innerHTML = `
      <div class="completion-content">
        <h2>🎉 Congratulations! 🎉</h2>
        <p>You've completed the puzzle!</p>
        <button class="btn btn-primary" onclick="this.parentElement.parentElement.remove()">
          Continue
        </button>
      </div>
    `
    
    // Add to the page
    document.body.appendChild(message)
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (message.parentElement) {
        message.remove()
      }
    }, 10000)
  }

  showMessage(text, type = 'info') {
    const message = document.createElement('div')
    message.className = `alert alert-${type} puzzle-message`
    message.textContent = text
    
    // Find a good place to show the message
    const controls = this.element.querySelector('.game-controls')
    if (controls) {
      controls.appendChild(message)
    } else {
      document.body.appendChild(message)
    }
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (message.parentElement) {
        message.remove()
      }
    }, 3000)
  }
}
