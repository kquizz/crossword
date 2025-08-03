import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = {
    gridWidth: Number,
    gridHeight: Number
  }

  connect() {
    this.zoomLevel = 1
    this.bindEvents()
    
    // Apply initial zoom after a brief delay to ensure DOM is ready
    setTimeout(() => this.applyZoom(), 10)
  }

  bindEvents() {
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
      const totalWidth = this.gridWidthValue * zoomedSize + (this.gridWidthValue + 1) * 1  // +1px for borders/gaps
      const totalHeight = this.gridHeightValue * zoomedSize + (this.gridHeightValue + 1) * 1
      
      gridContainer.style.width = totalWidth + 'px'
      gridContainer.style.height = totalHeight + 'px'

      // Don't override the gap - let CSS handle borders
      // gridContainer.style.gap = gap + 'px'
    }
  }

  calculateBaseCellSize() {
    // Calculate appropriate cell size based on grid dimensions and viewport
    const gridSize = Math.max(this.gridWidthValue, this.gridHeightValue)
    const viewportWidth = window.innerWidth * 0.85  // Leave some margin
    const viewportHeight = window.innerHeight * 0.6  // Account for header/controls
    
    // Calculate maximum cell size that fits the grid in viewport
    const maxCellWidth = Math.floor(viewportWidth / this.gridWidthValue)
    const maxCellHeight = Math.floor(viewportHeight / this.gridHeightValue)
    const maxCellSize = Math.min(maxCellWidth, maxCellHeight)
    
    // Set reasonable bounds
    return Math.max(15, Math.min(maxCellSize, 80))
  }

  // Public method to be called when grid dimensions change
  updateGridDimensions(width, height) {
    this.gridWidthValue = width
    this.gridHeightValue = height
    this.applyZoom()
  }
}
