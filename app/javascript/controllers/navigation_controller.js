import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = {
    gridWidth: Number,
    gridHeight: Number,
    mode: String
  }

  connect() {
    this.direction = 'across'
    this.selectedRow = null
    this.selectedCol = null
    this.gridData = null
  }

  // Basic directional movement within current word
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
      // Try using a regular DOM event that bubbles
      const event = new CustomEvent('move-to-cell', {
        detail: { row: nextRow, col: nextCol },
        bubbles: true
      })
      this.element.dispatchEvent(event)
    }
  }

  // Move to next word start
  moveToNextWord() {
    const currentRow = this.selectedRow
    const currentCol = this.selectedCol
    
    // Find the next word start anywhere in the grid
    let foundNextWord = false
    
    // Start searching from current position
    for (let row = 0; row < this.gridHeightValue; row++) {
      for (let col = 0; col < this.gridWidthValue; col++) {
        // Skip positions before current position
        if (row < currentRow || (row === currentRow && col <= currentCol)) {
          continue
        }
        
        // Check if this position starts a word in the current direction
        if (this.isWordStart(row, col, this.direction)) {
          const event = new CustomEvent('move-to-cell', {
            detail: { row: row, col: col },
            bubbles: true
          })
          this.element.dispatchEvent(event)
          foundNextWord = true
          break
        }
      }
      if (foundNextWord) break
    }
    
    // If no word found after current position, wrap around from beginning
    if (!foundNextWord) {
      for (let row = 0; row < this.gridHeightValue; row++) {
        for (let col = 0; col < this.gridWidthValue; col++) {
          // Skip positions after current position (we already checked those)
          if (row > currentRow || (row === currentRow && col >= currentCol)) {
            continue
          }
          
          // Check if this position starts a word in the current direction
          if (this.isWordStart(row, col, this.direction)) {
            const event = new CustomEvent('move-to-cell', {
              detail: { row: row, col: col },
              bubbles: true
            })
            this.element.dispatchEvent(event)
            foundNextWord = true
            break
          }
        }
        if (foundNextWord) break
      }
    }
    
    // If still no word found, try switching direction
    if (!foundNextWord) {
      const oppositeDirection = this.direction === 'across' ? 'down' : 'across'
      for (let row = 0; row < this.gridHeightValue; row++) {
        for (let col = 0; col < this.gridWidthValue; col++) {
          if (this.isWordStart(row, col, oppositeDirection)) {
            this.direction = oppositeDirection
            
            const directionEvent = new CustomEvent('direction-changed', {
              detail: { direction: this.direction },
              bubbles: true
            })
            this.element.dispatchEvent(directionEvent)
            
            const moveEvent = new CustomEvent('move-to-cell', {
              detail: { row: row, col: col },
              bubbles: true
            })
            this.element.dispatchEvent(moveEvent)
            
            foundNextWord = true
            break
          }
        }
        if (foundNextWord) break
      }
    }
  }

  // Move to previous word start
  moveToPreviousWord() {
    const currentRow = this.selectedRow
    const currentCol = this.selectedCol
    
    // Find the previous word start anywhere in the grid (search backwards)
    let foundPrevWord = false
    
    // Start searching backwards from current position
    for (let row = this.gridHeightValue - 1; row >= 0; row--) {
      for (let col = this.gridWidthValue - 1; col >= 0; col--) {
        // Skip positions after current position
        if (row > currentRow || (row === currentRow && col >= currentCol)) {
          continue
        }
        
        // Check if this position starts a word in the current direction
        if (this.isWordStart(row, col, this.direction)) {
          const event = new CustomEvent('move-to-cell', {
            detail: { row: row, col: col },
            bubbles: true
          })
          this.element.dispatchEvent(event)
          foundPrevWord = true
          break
        }
      }
      if (foundPrevWord) break
    }
    
    // If no word found before current position, wrap around from end
    if (!foundPrevWord) {
      for (let row = this.gridHeightValue - 1; row >= 0; row--) {
        for (let col = this.gridWidthValue - 1; col >= 0; col--) {
          // Skip positions before current position (we already checked those)
          if (row < currentRow || (row === currentRow && col <= currentCol)) {
            continue
          }
          
          // Check if this position starts a word in the current direction
          if (this.isWordStart(row, col, this.direction)) {
            const event = new CustomEvent('move-to-cell', {
              detail: { row: row, col: col },
              bubbles: true
            })
            this.element.dispatchEvent(event)
            foundPrevWord = true
            break
          }
        }
        if (foundPrevWord) break
      }
    }
    
    // If still no word found, try switching direction
    if (!foundPrevWord) {
      const oppositeDirection = this.direction === 'across' ? 'down' : 'across'
      for (let row = this.gridHeightValue - 1; row >= 0; row--) {
        for (let col = this.gridWidthValue - 1; col >= 0; col--) {
          if (this.isWordStart(row, col, oppositeDirection)) {
            this.direction = oppositeDirection
            
            const directionEvent = new CustomEvent('direction-changed', {
              detail: { direction: this.direction },
              bubbles: true
            })
            this.element.dispatchEvent(directionEvent)
            
            const moveEvent = new CustomEvent('move-to-cell', {
              detail: { row: row, col: col },
              bubbles: true
            })
            this.element.dispatchEvent(moveEvent)
            
            foundPrevWord = true
            break
          }
        }
        if (foundPrevWord) break
      }
    }
  }

  // Simple cell-to-cell movement
  moveSelection(newRow, newCol) {
    if (this.isValidPosition(newRow, newCol)) {
      const event = new CustomEvent('move-to-cell', {
        detail: { row: newRow, col: newCol },
        bubbles: true
      })
      this.element.dispatchEvent(event)
    }
  }

  // Toggle direction between across and down
  toggleDirection() {
    // Don't toggle direction in block mode
    if (this.modeValue === 'create' && this.isBlockMode) {
      return
    }

    this.direction = this.direction === 'across' ? 'down' : 'across'
    
    // Use DOM CustomEvent with bubbles for proper inter-controller communication
    const event = new CustomEvent('direction-changed', {
      detail: { direction: this.direction },
      bubbles: true
    })
    this.element.dispatchEvent(event)
  }

  // Helper method to check if a position starts a word in the given direction
  isWordStart(row, col, direction) {
    // Cell must not be blocked
    if (this.isCellBlocked(row, col)) {
      return false
    }

    if (direction === 'across') {
      // For across words: either at left edge OR previous cell is blocked
      const prevCellBlocked = col === 0 || this.isCellBlocked(row, col - 1)
      // And there must be at least one more cell to the right that's not blocked
      const hasNextCell = col < this.gridWidthValue - 1 && !this.isCellBlocked(row, col + 1)
      return prevCellBlocked && hasNextCell
    } else {
      // For down words: either at top edge OR cell above is blocked
      const prevCellBlocked = row === 0 || this.isCellBlocked(row - 1, col)
      // And there must be at least one more cell below that's not blocked
      const hasNextCell = row < this.gridHeightValue - 1 && !this.isCellBlocked(row + 1, col)
      return prevCellBlocked && hasNextCell
    }
  }

  // Update direction indicator in UI
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

  // Helper methods (these will need to get data from main controller)
  isValidPosition(row, col) {
    // Delegate to main controller's isValidPosition method
    const mainController = this.application.getControllerForElementAndIdentifier(this.element, 'crossword-game')
    if (mainController) {
      return mainController.isValidPosition(row, col)
    }
    // Fallback implementation
    return row >= 0 && row < this.gridHeightValue && col >= 0 && col < this.gridWidthValue
  }

  isCellBlocked(row, col) {
    // Delegate to main controller's isCellBlocked method
    const mainController = this.application.getControllerForElementAndIdentifier(this.element, 'crossword-game')
    if (mainController) {
      return mainController.isCellBlocked(row, col)
    }
    // Fallback implementation
    if (!this.gridData || !this.gridData[row]) {
      return true
    }
    return this.gridData[row][col] === '#'
  }

  // Public methods to be called by main controller
  updateCurrentPosition(row, col) {
    this.selectedRow = row
    this.selectedCol = col
  }

  updateGridData(gridData) {
    this.gridData = gridData
  }

  updateDirection(direction) {
    this.direction = direction
    this.updateDirectionIndicator()
  }

  updateGridDimensions(width, height) {
    this.gridWidthValue = width
    this.gridHeightValue = height
  }

  setBlockMode(isBlockMode) {
    this.isBlockMode = isBlockMode
  }
}
