import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = {
    mode: String
  }

  connect() {
    this.cluesData = null // Store clues data
    this.currentClue = null // Track current active clue
    
    // Only initialize for play mode
    if (this.modeValue === 'play') {
      this.loadCluesData()
      this.bindClueClickEvents()
    }
  }

  // Load clues data from the grid element
  loadCluesData() {
    const gridElement = this.element.querySelector('.crossword-interactive-grid')
    if (gridElement && gridElement.dataset.clues) {
      try {
        this.cluesData = JSON.parse(gridElement.dataset.clues)
        console.log('📋 Loaded clues data:', this.cluesData)
      } catch (e) {
        console.error('Failed to parse clues data:', e)
        this.cluesData = { across: [], down: [] }
      }
    } else {
      this.cluesData = { across: [], down: [] }
    }
    
    // Set up protection for server-rendered clues
    this.protectServerRenderedClues()
  }

  // Protect server-rendered clues from being overwritten
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
          console.log('🛡️ Protected server-rendered clues from being overwritten')
        }
      })
      
      Object.defineProperty(downList, 'innerHTML', {
        get: function() { return this._innerHTML || originalDownHTML },
        set: function(value) {
          // Silently ignore attempts to change innerHTML in play mode
          console.log('🛡️ Protected server-rendered clues from being overwritten')
        }
      })
    }
  }

  // Bind clue click events
  bindClueClickEvents() {
    this.element.addEventListener('click', this.handleClueClick.bind(this))
  }

  // Handle clicks on clue items
  handleClueClick(event) {
    const clueItem = event.target.closest('.clue-item')
    if (!clueItem) return

    event.preventDefault()
    
    const direction = clueItem.dataset.direction
    const number = parseInt(clueItem.dataset.number)
    const row = parseInt(clueItem.dataset.row)
    const col = parseInt(clueItem.dataset.col)

    console.log(`🎯 Clue clicked: ${number} ${direction} at (${row}, ${col})`)

    // Notify main controller to navigate to the clue's starting cell
    const event_data = new CustomEvent('clue-selected', {
      detail: { 
        direction, 
        number, 
        row, 
        col,
        clueItem
      },
      bubbles: true
    })
    this.element.dispatchEvent(event_data)

    // Set this clue as active
    this.setActiveClue(clueItem, direction, number)
  }

  // Set a clue as the active clue
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
    const clueLength = clueItem.querySelector('.clue-length')?.textContent || ''
    
    this.updateCurrentClueDisplay(direction, number, clueText, clueLength)
    this.currentClue = { direction, number, clueText }

    console.log(`✅ Set active clue: ${number} ${direction}`)
  }

  // Scroll a clue item into view
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

  // Update the current clue display area
  updateCurrentClueDisplay(direction, number, clueText, clueLength) {
    const titleElement = this.element.querySelector('#current-clue-title')
    const textElement = this.element.querySelector('#current-clue-text')

    if (titleElement && textElement) {
      titleElement.textContent = `${number} ${direction.charAt(0).toUpperCase() + direction.slice(1)}`
      textElement.textContent = `${clueText} ${clueLength}`.trim()
      
      console.log(`📺 Updated current clue display: ${number} ${direction}`)
    }
  }

  // Update current clue based on position (called from main controller)
  updateCurrentClueFromPosition(row, col, direction) {
    if (!this.cluesData) return

    console.log(`🔍 Finding clue for position (${row}, ${col}) in ${direction} direction`)

    // Find the clue that matches the current position and direction
    const clues = this.cluesData[direction] || []
    const matchingClue = clues.find(clue => {
      if (direction === 'across') {
        return clue.row === row && clue.col <= col && 
               col < clue.col + clue.answer.length
      } else {
        return clue.col === col && clue.row <= row && 
               row < clue.row + clue.answer.length
      }
    })

    if (matchingClue) {
      console.log(`✅ Found matching clue: ${matchingClue.number} ${direction}`)
      
      // Find and activate the corresponding clue item
      const clueItem = this.element.querySelector(
        `.clue-item[data-direction="${direction}"][data-number="${matchingClue.number}"]`
      )
      if (clueItem) {
        this.setActiveClue(clueItem, direction, matchingClue.number)
      }
    } else {
      console.log(`❌ No matching clue found for position (${row}, ${col}) in ${direction}`)
    }
  }

  // Check if a specific clue's word is completely filled (used by main controller)
  isClueWordComplete(clue) {
    // Get grid data from main controller
    const mainController = this.application.getControllerForElementAndIdentifier(this.element, 'crossword-game')
    if (!mainController) return false

    const gridData = mainController.gridData
    
    if (clue.direction === 'across') {
      // Check across word
      for (let i = 0; i < clue.answer.length; i++) {
        const checkCol = clue.col + i
        if (checkCol >= gridData[0].length || !gridData[clue.row][checkCol]) {
          return false
        }
      }
    } else {
      // Check down word  
      for (let i = 0; i < clue.answer.length; i++) {
        const checkRow = clue.row + i
        if (checkRow >= gridData.length || !gridData[checkRow][clue.col]) {
          return false
        }
      }
    }
    return true
  }

  // Find the next unfilled word starting from a given number (used by main controller)
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

  // Find the previous unfilled word starting from a given number (used by main controller)
  findPreviousUnfilledWord(startNumber, direction) {
    if (!this.cluesData || !this.cluesData[direction]) {
      return null
    }

    const clues = this.cluesData[direction]
    const sortedClues = [...clues].sort((a, b) => b.number - a.number) // Sort in descending order

    // First, try to find words with numbers lower than startNumber
    for (const clue of sortedClues) {
      if (clue.number < startNumber && !this.isClueWordComplete(clue)) {
        return { row: clue.row, col: clue.col, direction, number: clue.number }
      }
    }

    // If no lower numbers found, loop back from the end
    for (const clue of sortedClues) {
      if (clue.number >= startNumber && !this.isClueWordComplete(clue)) {
        return { row: clue.row, col: clue.col, direction, number: clue.number }
      }
    }

    return null
  }

  // Get clues data (public accessor)
  getCluesData() {
    return this.cluesData
  }

  // Get current clue (public accessor)
  getCurrentClue() {
    return this.currentClue
  }
}
