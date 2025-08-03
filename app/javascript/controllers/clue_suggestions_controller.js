import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = {
    puzzleId: Number,
    mode: String
  }

  connect() {
    this.usedClueIds = new Set() // Track used clue IDs to prevent duplicates
    this.appliedClues = new Map() // Track which clues are applied to which word positions
  }

  // Main method to update clue suggestions based on current word
  updateCluesSuggestions(row, col, wordInfo, gridData) {
    if (this.modeValue !== 'create') return

    if (wordInfo && wordInfo.length >= 3) {
      this.fetchMatchingClues(wordInfo, gridData)
    } else {
      this.clearCluesSuggestions()
    }
  }

  // Fetch matching clues from server
  fetchMatchingClues(wordInfo, gridData) {
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
    const intersectingConstraints = this.getIntersectingConstraints(wordInfo, gridData)

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

  // Get constraints from intersecting words
  getIntersectingConstraints(wordInfo, gridData) {
    const constraints = []
    const positions = this.getWordPositions(wordInfo)

    console.log(`🎯 Getting intersecting constraints for ${wordInfo.direction} word at ${wordInfo.startRow},${wordInfo.startCol}`)
    console.log('📍 Word positions:', positions)

    positions.forEach((pos, index) => {
      // For each position in the current word, check if there are intersecting words
      const intersectingWordInfo = this.getIntersectingWordAt(pos.row, pos.col, wordInfo.direction, gridData)
      
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

  // Get intersecting word information at a specific position
  getIntersectingWordAt(row, col, currentDirection, gridData) {
    // Get grid numbering to find word starts
    const mainController = this.application.getControllerForElementAndIdentifier(this.element, 'crossword-game')
    if (!mainController) return null
    
    const numbering = mainController.calculateGridNumbering(gridData)
    
    let wordInfo = null
    
    if (currentDirection === 'across') {
      // Look for intersecting DOWN word at this position
      let startRow = row
      let endRow = row
      
      // Find start of down word
      while (startRow > 0 && gridData[startRow - 1][col] !== '#') {
        startRow--
      }
      
      // Find end of down word  
      while (endRow < gridData.length - 1 && gridData[endRow + 1][col] !== '#') {
        endRow++
      }
      
      // Build pattern for this down word
      let pattern = ''
      let hasConstraints = false
      
      for (let r = startRow; r <= endRow; r++) {
        const cellValue = gridData[r][col]
        if (cellValue && cellValue !== '#') {
          pattern += cellValue
          hasConstraints = true // Has existing letters
        } else {
          pattern += '_'
        }
      }

      // Check if this position would start a numbered word
      const wordNumber = numbering[`${startRow},${col}`]
      if (wordNumber || hasConstraints) {
        wordInfo = {
          direction: 'down',
          pattern: pattern,
          intersectionPosition: row - startRow,
          hasConstraints: hasConstraints || (endRow - startRow + 1) >= 3
        }
      }
    } else {
      // Look for intersecting ACROSS word at this position
      let startCol = col
      let endCol = col
      
      // Find start of across word
      while (startCol > 0 && gridData[row][startCol - 1] !== '#') {
        startCol--
      }
      
      // Find end of across word
      while (endCol < gridData[row].length - 1 && gridData[row][endCol + 1] !== '#') {
        endCol++
      }
      
      // Build pattern for this across word
      let pattern = ''
      let hasConstraints = false
      
      for (let c = startCol; c <= endCol; c++) {
        const cellValue = gridData[row][c]
        if (cellValue && cellValue !== '#') {
          pattern += cellValue
          hasConstraints = true // Has existing letters
        } else {
          pattern += '_'
        }
      }

      // Check if this position would start a numbered word
      const wordNumber = numbering[`${row},${startCol}`]
      if (wordNumber || hasConstraints) {
        wordInfo = {
          direction: 'across',
          pattern: pattern,
          intersectionPosition: col - startCol,
          hasConstraints: hasConstraints || (endCol - startCol + 1) >= 3
        }
      }
    }
    
    return wordInfo
  }

  // Display available clues to user
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

  // Apply a clue to the current word
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

    // Notify main controller to fill in the answer
    const event = new CustomEvent('clue-applied', {
      detail: { 
        clueId, 
        answer, 
        wordInfo, 
        completions,
        appliedClues: this.appliedClues,
        usedClueIds: this.usedClueIds
      },
      bubbles: true
    })
    this.element.dispatchEvent(event)

    // Process any completed intersections
    completions.forEach(completion => {
      console.log('🔗 Auto-applying completed intersection:', completion)
      
      // Mark this clue as used
      this.usedClueIds.add(completion.clue_id.toString())

      // Notify main controller about the completion
      const completionEvent = new CustomEvent('intersection-completed', {
        detail: { completion },
        bubbles: true
      })
      this.element.dispatchEvent(completionEvent)
    })

    // Save the clue association to the puzzle (if we have a puzzle ID)
    if (this.puzzleIdValue) {
      this.savePuzzleClue(clueId, wordInfo.number, wordInfo.direction)
    }
    
    // Refresh the clues suggestions to show the undo option
    this.displayCluesSuggestions([], wordInfo)
    
    // Notify main controller to update clues preview
    const previewEvent = new CustomEvent('update-clues-preview', {
      detail: { appliedClues: this.appliedClues },
      bubbles: true
    })
    this.element.dispatchEvent(previewEvent)
  }

  // Remove a clue from current word
  undoClueForWord(wordKey, currentWordInfo) {
    const appliedClue = this.appliedClues.get(wordKey)
    if (!appliedClue) return

    // Remove the clue from used clues set
    this.usedClueIds.delete(appliedClue.clueId.toString())

    // Remove the clue from applied clues
    this.appliedClues.delete(wordKey)

    // Notify main controller to clear the cells
    const event = new CustomEvent('clue-undone', {
      detail: { 
        wordKey, 
        wordInfo: appliedClue.wordInfo,
        appliedClues: this.appliedClues
      },
      bubbles: true
    })
    this.element.dispatchEvent(event)

    // Refresh the clues suggestions
    this.updateCluesSuggestions(currentWordInfo.startRow, currentWordInfo.startCol, currentWordInfo, null)
    
    // Notify main controller to update clues preview
    const previewEvent = new CustomEvent('update-clues-preview', {
      detail: { appliedClues: this.appliedClues },
      bubbles: true
    })
    this.element.dispatchEvent(previewEvent)
  }

  // Save clue association to puzzle
  savePuzzleClue(clueId, number, direction) {
    fetch('/crossword_game/save_clue', {
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
      if (!data.success) {
        console.error('Failed to save puzzle clue:', data.error)
      }
    })
    .catch(error => {
      console.error('Error saving puzzle clue:', error)
    })
  }

  // Clear clue suggestions panel
  clearCluesSuggestions() {
    const cluesPanel = this.element.querySelector('.clues-suggestions')
    if (cluesPanel) {
      cluesPanel.innerHTML = '<p class="no-selection">Select a word to see matching clues</p>'
    }
  }

  // Helper method to get word positions
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

  // Public methods to be called by main controller
  syncUsedClues(usedClueIds) {
    this.usedClueIds = new Set(usedClueIds)
  }

  syncAppliedClues(appliedClues) {
    this.appliedClues = new Map(appliedClues)
  }

  getUsedClueIds() {
    return this.usedClueIds
  }

  getAppliedClues() {
    return this.appliedClues
  }
}
