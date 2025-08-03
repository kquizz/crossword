import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = {
    gridWidth: Number,
    gridHeight: Number
  }

  connect() {
    console.log("Highlight Controller connected")
    this.highlightedCells = []
  }

  // Clear all highlighted cells
  clearHighlights() {
    this.highlightedCells.forEach(cell => {
      cell.classList.remove('highlighted')
    })
    this.highlightedCells = []
  }

  // Highlight the current word based on position and direction
  highlightCurrentWord(row, col, direction, gridData) {
    // Clear existing highlights first
    this.clearHighlights()

    if (direction === 'across') {
      this.highlightAcrossWord(row, col, gridData)
    } else {
      this.highlightDownWord(row, col, gridData)
    }
  }

  // Highlight an across word at the given position
  highlightAcrossWord(row, col, gridData) {
    // Find start of word (leftmost non-blocked cell)
    let startCol = col
    while (startCol > 0 && !this.isCellBlocked(row, startCol - 1, gridData)) {
      startCol--
    }

    // Find end of word (rightmost non-blocked cell)
    let endCol = col
    while (endCol < this.gridWidthValue - 1 && !this.isCellBlocked(row, endCol + 1, gridData)) {
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

  // Highlight a down word at the given position
  highlightDownWord(row, col, gridData) {
    // Find start of word (topmost non-blocked cell)
    let startRow = row
    while (startRow > 0 && !this.isCellBlocked(startRow - 1, col, gridData)) {
      startRow--
    }

    // Find end of word (bottommost non-blocked cell)
    let endRow = row
    while (endRow < this.gridHeightValue - 1 && !this.isCellBlocked(endRow + 1, col, gridData)) {
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

  // Helper method to get DOM element for specific cell
  getCellElement(row, col) {
    return this.element.querySelector(`.crossword-cell[data-row="${row}"][data-col="${col}"]`)
  }

  // Helper method to check if cell is blocked
  isCellBlocked(row, col, gridData) {
    if (row < 0 || row >= this.gridHeightValue || col < 0 || col >= this.gridWidthValue) {
      return true
    }
    return gridData[row][col] === '#'
  }

  // Update grid dimensions
  updateGridDimensions(width, height) {
    this.gridWidthValue = width
    this.gridHeightValue = height
  }
}
